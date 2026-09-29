import React, {ReactNode, useCallback, useEffect, useState} from 'react';
import {
  ActivityIndicator,
  AppState,
  Linking,
  Modal,
  NativeModules,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import {SafeAreaProvider, SafeAreaView} from 'react-native-safe-area-context';

type Settings = {
  name: string;
  subjects: string;
  grades: string;
  days: string;
  theme: 'dark' | 'light';
  teacherSelected?: boolean;
};

type ApiDay = {iso: string; label: string};
type ApiMatch = {title?: string; type?: string; note?: string; className?: string};
type ApiSchedule = {days?: ApiDay[]; periods?: number[]; grid?: ApiMatch[][][]};
type TeacherOption = {name: string; label: string; subjects: string[]};
type ClassLesson = {title?: string; type?: string; teacher?: string};
type ClassSchedule = {
  classes?: string[];
  days?: ApiDay[];
  periods?: number[];
  timetables?: Record<string, ClassLesson[][]>;
};

type NativeWidgetSettings = {
  getSettings(): Promise<Settings>;
  getCachedTeacherSchedule(): Promise<string>;
  cacheTeacherSchedule(json: string, teacher: string): Promise<void>;
  setTeacherName(name: string): Promise<string>;
  setTheme(theme: 'dark' | 'light'): Promise<string>;
  refreshWidgets(): Promise<void>;
};

const WidgetSettings = NativeModules.WidgetSettings as NativeWidgetSettings;
const DEFAULT_SETTINGS: Settings = {
  name: '최세영',
  subjects: '',
  grades: '',
  days: 'mon,tue,wed,thu,fri',
  theme: 'dark',
};
const START_TIMES = ['08:40', '09:35', '10:30', '11:25', '13:20', '14:15', '15:10', '16:05', '16:55'];
const END_TIMES = ['09:25', '10:20', '11:15', '12:10', '14:05', '15:00', '15:55', '16:45', '17:35'];
const PALETTES = {
  dark: {
    background: '#151619',
    panel: '#1D1E23',
    panelStrong: '#25262C',
    border: '#303137',
    primary: '#F2F2F4',
    secondary: '#A0A1A8',
    muted: '#62646C',
    accent: '#5E9BD8',
    button: '#27282E',
    buttonText: '#E5E5E8',
    change: '#D5A64B',
    added: '#D07474',
    event: '#55A484',
  },
  light: {
    background: '#F3F4F6',
    panel: '#FFFFFF',
    panelStrong: '#E9EBEF',
    border: '#E0E1E5',
    primary: '#202127',
    secondary: '#777982',
    muted: '#AAABB1',
    accent: '#397FC0',
    button: '#E9EBEF',
    buttonText: '#34363D',
    change: '#A77A25',
    added: '#B64D4D',
    event: '#347D63',
  },
};

function todayInKorea() {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function minutesNowInKorea() {
  const koreaTime = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return koreaTime.getUTCHours() * 60 + koreaTime.getUTCMinutes();
}

function toMinutes(value: string) {
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

function teacherScheduleUrl(name: string) {
  const params: [string, string][] = [
    ['format', 'json'],
    ['teacher', name],
    ['v', String(Date.now())],
  ];
  return 'https://schedule.yjms.kr/wallpaper.png?' + params
    .map(([key, value]) => encodeURIComponent(key) + '=' + encodeURIComponent(value))
    .join('&');
}

function classScheduleUrl() {
  return 'https://schedule.yjms.kr/wallpaper.png?format=classes&v=' + Date.now();
}

function teacherListUrl() {
  return 'https://schedule.yjms.kr/wallpaper.png?format=teachers&v=' + Date.now();
}

function dateNumber(iso: string) {
  return Number(iso.slice(-2));
}

function dateLabel(day: ApiDay) {
  return dateNumber(day.iso) + ' ' + day.label;
}

function firstRemainingPeriod(now: number) {
  for (let index = 0; index < END_TIMES.length; index += 1) {
    if (now <= toMinutes(END_TIMES[index])) return index;
  }
  return END_TIMES.length;
}

function lessonColor(type: string | undefined, colors: typeof PALETTES.dark) {
  if (type === 'new') return colors.added;
  if (type === 'change') return colors.change;
  if (type === 'event') return colors.event;
  return colors.border;
}

function AppContent() {
  const {width: screenWidth} = useWindowDimensions();
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [schedule, setSchedule] = useState<ApiSchedule | null>(null);
  const [clock, setClock] = useState(minutesNowInKorea);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [teacherModalVisible, setTeacherModalVisible] = useState(false);
  const [teacherDraft, setTeacherDraft] = useState(DEFAULT_SETTINGS.name);
  const [firstRun, setFirstRun] = useState(false);
  const [teacherOptions, setTeacherOptions] = useState<TeacherOption[]>([]);
  const [teacherListLoading, setTeacherListLoading] = useState(false);
  const [teacherListError, setTeacherListError] = useState('');
  const [activeTab, setActiveTab] = useState('교사 보기');
  const [classSchedule, setClassSchedule] = useState<ClassSchedule | null>(null);
  const [selectedClass, setSelectedClass] = useState('');
  const [classLoading, setClassLoading] = useState(false);
  const [classError, setClassError] = useState('');
  const colors = PALETTES[settings.theme];
  const days = schedule?.days || [];
  const periods = schedule?.periods || START_TIMES.map((_, index) => index + 1);
  const todayIndex = days.findIndex(day => day.iso === todayInKorea());
  const todayGrid = todayIndex >= 0 ? schedule?.grid?.[todayIndex] || [] : [];
  const now = clock;
  const currentPeriodIndex = START_TIMES.findIndex((start, index) =>
    now >= toMinutes(start) && now <= toMinutes(END_TIMES[index]),
  );
  const remainingStart = firstRemainingPeriod(now);
  const todayMatches = todayGrid.flatMap((matches, periodIndex) =>
    matches.map(match => ({...match, periodIndex})),
  );
  const weeklyHours = (schedule?.grid || []).reduce(
    (total, day) => total + day.filter(matches => matches.length > 0).length,
    0,
  );
  const subjects = [...new Set((schedule?.grid || []).flat(2).map(match => match.title).filter(Boolean))];
  const subjectSummary = subjects.slice(0, 2).join(' · ') || '교사 시간표';
  const gridWidth = Math.max(0, screenWidth - 32);
  const periodWidth = Math.min(64, Math.max(48, gridWidth * 0.165));
  const dayWidth = Math.floor(
    Math.max(0, gridWidth - 2 - days.length - periodWidth) / Math.max(days.length, 1),
  );

  const loadSettings = useCallback(async () => {
    try {
      const saved = await WidgetSettings.getSettings();
      const next = {...DEFAULT_SETTINGS, ...saved};
      setSettings(next);
      return next;
    } catch {
      setSettings(DEFAULT_SETTINGS);
      return DEFAULT_SETTINGS;
    }
  }, []);

  const refresh = useCallback(async (override?: Settings) => {
    setRefreshing(true);
    setError('');
    try {
      const currentSettings = override || await WidgetSettings.getSettings();
      const response = await fetch(teacherScheduleUrl(currentSettings.name || DEFAULT_SETTINGS.name));
      if (!response.ok) throw new Error('시간표 요청 실패 (' + response.status + ')');
      const json = await response.text();
      const parsed = JSON.parse(json) as ApiSchedule;
      setSchedule(parsed);
      await WidgetSettings.cacheTeacherSchedule(json, currentSettings.name || DEFAULT_SETTINGS.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : '시간표를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const loadClassSchedule = useCallback(async () => {
    setClassLoading(true);
    setClassError('');
    try {
      const response = await fetch(classScheduleUrl());
      if (!response.ok) throw new Error('학급 시간표 요청 실패 (' + response.status + ')');
      const parsed = await response.json() as ClassSchedule;
      setClassSchedule(parsed);
      setSelectedClass(current => current || parsed.classes?.[0] || '');
    } catch (err) {
      setClassError(err instanceof Error ? err.message : '학급 시간표를 불러오지 못했습니다.');
    } finally {
      setClassLoading(false);
    }
  }, []);

  const loadTeacherOptions = useCallback(async () => {
    setTeacherListLoading(true);
    setTeacherListError('');
    try {
      const response = await fetch(teacherListUrl());
      if (!response.ok) throw new Error('교사 목록 요청 실패 (' + response.status + ')');
      const parsed = await response.json() as {teachers?: TeacherOption[]};
      setTeacherOptions(parsed.teachers || []);
    } catch (err) {
      setTeacherListError(err instanceof Error ? err.message : '교사 목록을 불러오지 못했습니다.');
    } finally {
      setTeacherListLoading(false);
    }
  }, []);

  const openTeacherModal = useCallback(() => {
    setTeacherDraft('');
    setTeacherModalVisible(true);
    loadTeacherOptions();
  }, [loadTeacherOptions]);

  const loadInitialData = useCallback(async () => {
    const saved = await loadSettings();
    if (saved.teacherSelected === false) {
      setFirstRun(true);
      openTeacherModal();
      setLoading(false);
      return;
    }
    try {
      const cached = await WidgetSettings.getCachedTeacherSchedule();
      if (cached) {
        const cache = JSON.parse(cached) as {teacher?: string; json?: string};
        if (cache.teacher === saved.name && cache.json) setSchedule(JSON.parse(cache.json) as ApiSchedule);
      }
    } catch {
      setSchedule(null);
    }
    await refresh(saved);
  }, [loadSettings, openTeacherModal, refresh]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  useEffect(() => {
    const clockTimer = setInterval(() => setClock(minutesNowInKorea()), 30000);
    const appState = AppState.addEventListener('change', nextState => {
      if (nextState === 'active') loadInitialData();
    });
    return () => {
      clearInterval(clockTimer);
      appState.remove();
    };
  }, [loadInitialData]);

  const toggleTheme = async () => {
    const nextTheme = settings.theme === 'dark' ? 'light' : 'dark';
    await WidgetSettings.setTheme(nextTheme);
    setSettings({...settings, theme: nextTheme});
  };

  const saveTeacher = async (name: string) => {
    if (!name) return;
    const savedName = await WidgetSettings.setTeacherName(name);
    const next = {...settings, name: savedName, teacherSelected: true};
    setSettings(next);
    setFirstRun(false);
    setTeacherModalVisible(false);
    await refresh(next);
  };

  const pressTab = async (tab: string) => {
    if (tab === '다운로드') {
      try {
        await Linking.openURL('https://schedule.yjms.kr/download');
      } catch {
        setError('다운로드 페이지를 열지 못했습니다.');
      }
      return;
    }
    setActiveTab(tab);
    if (tab === '시간표' && !classSchedule && !classLoading) loadClassSchedule();
  };

  const teacherTitle = firstRun ? '교사 선택' : settings.name || '교사';
  const teacherQuery = teacherDraft.trim();
  const filteredTeachers = teacherOptions.filter(teacher =>
    !teacherQuery
    || teacher.name.includes(teacherQuery)
    || teacher.label.includes(teacherQuery)
    || teacher.subjects.some(subject => subject.includes(teacherQuery)),
  );
  const lessonBackground = (type: string | undefined) => {
    if (type === 'change') return colors.change + '22';
    if (type === 'new') return colors.added + '22';
    if (type === 'event') return colors.event + '22';
    return colors.panel;
  };

  const renderLegend = (note: string) => (
    <View style={styles.legend}>
      <LegendItem label="교과 변경" color={colors.change} textColor={colors.secondary} />
      <LegendItem label="신설 수업" color={colors.added} textColor={colors.secondary} />
      <LegendItem label="행사" color={colors.event} textColor={colors.secondary} />
      <Text style={[styles.legendNote, {color: colors.secondary}]}>{note}</Text>
    </View>
  );

  const renderWeekGrid = (
    gridDays: ApiDay[],
    gridPeriods: number[],
    renderCell: (dayIndex: number, periodIndex: number) => ReactNode,
  ) => {
    const cellWidth = Math.floor(
      Math.max(0, gridWidth - 2 - gridDays.length - periodWidth) / Math.max(gridDays.length, 1),
    );
    return (
      <View style={[styles.grid, {width: gridWidth, backgroundColor: colors.border}]}>
        <View style={[styles.gridRow, styles.headerGridRow]}>
          <View style={[styles.cornerCell, {width: periodWidth, backgroundColor: colors.panelStrong}]}>
            <Text style={[styles.headerText, {color: colors.secondary}]}>교시</Text>
          </View>
          {gridDays.map(day => {
            const isToday = day.iso === todayInKorea();
            return (
              <View key={day.iso} style={[styles.dayHeader, {width: cellWidth, backgroundColor: colors.panelStrong}]}>
                <Text style={[styles.headerText, {fontSize: Math.min(11, cellWidth * 0.19), color: isToday ? colors.primary : colors.secondary}]}>
                  {day.label}
                </Text>
                <Text style={[styles.dayDate, {fontSize: Math.min(11, cellWidth * 0.19), color: isToday ? colors.accent : colors.muted}]}>
                  {dateNumber(day.iso)}
                </Text>
              </View>
            );
          })}
        </View>
        {gridPeriods.map((period, periodIndex) => (
          <View key={period + '-' + periodIndex} style={styles.gridRow}>
            <View style={[styles.periodCell, {width: periodWidth, backgroundColor: colors.panelStrong}]}>
              <Text style={[styles.periodNumber, {fontSize: Math.min(10, periodWidth * 0.18), color: colors.primary}]}>{period}교시</Text>
              <Text style={[styles.periodTime, {fontSize: Math.min(9, periodWidth * 0.16), color: colors.secondary}]}>{START_TIMES[periodIndex]}</Text>
              <Text style={[styles.periodTime, {fontSize: Math.min(9, periodWidth * 0.16), color: colors.secondary}]}>–{END_TIMES[periodIndex]}</Text>
            </View>
            {gridDays.map((day, dayIndex) => {
              const isToday = day.iso === todayInKorea();
              const isCurrent = isToday && currentPeriodIndex === periodIndex;
              const isPast = isToday && periodIndex < remainingStart && !isCurrent;
              return (
                <View
                  key={day.iso + '-' + periodIndex}
                  style={[
                    styles.lessonCell,
                    {width: cellWidth, backgroundColor: colors.panel, opacity: isPast ? 0.5 : 1},
                    isCurrent ? {borderLeftWidth: 3, borderLeftColor: colors.accent} : null,
                  ]}>
                  {renderCell(dayIndex, periodIndex)}
                </View>
              );
            })}
          </View>
        ))}
      </View>
    );
  };

  const renderClassPage = () => {
    const classNames = classSchedule?.classes || [];
    const classDays = classSchedule?.days || [];
    const classPeriods = classSchedule?.periods || START_TIMES.map((_, index) => index + 1);
    const table = (selectedClass && classSchedule?.timetables?.[selectedClass]) || [];
    return (
      <>
        {classError ? <Text style={styles.error}>{classError}</Text> : null}
        {classNames.length ? (
          <View style={styles.classChips}>
            {classNames.map(className => {
              const active = className === selectedClass;
              return (
                <Pressable
                  key={className}
                  accessibilityRole="button"
                  onPress={() => setSelectedClass(className)}
                  style={[
                    styles.classChip,
                    {borderColor: active ? colors.accent : colors.border, backgroundColor: active ? colors.accent + '22' : colors.panel},
                  ]}>
                  <Text style={[styles.classChipText, {color: active ? colors.primary : colors.secondary}]}>{className}</Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}
        {classLoading && !classSchedule ? (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.accent} />
            <Text style={[styles.loadingText, {color: colors.secondary}]}>학급 시간표 불러오는 중</Text>
          </View>
        ) : classDays.length && table.length ? (
          renderWeekGrid(classDays, classPeriods, (dayIndex, periodIndex) => {
            const lesson = table[dayIndex]?.[periodIndex];
            if (!lesson?.title) return <Text style={[styles.emptyMark, {color: colors.muted}]}>·</Text>;
            return (
              <View
                style={[
                  styles.lessonCard,
                  {borderLeftColor: lessonColor(lesson.type, colors), backgroundColor: lessonBackground(lesson.type)},
                ]}>
                <Text numberOfLines={2} style={[styles.lessonClass, {fontSize: Math.max(9, Math.min(12, dayWidth * 0.2)), color: colors.primary}]}>
                  {lesson.title}
                </Text>
                {lesson.teacher ? (
                  <Text numberOfLines={1} style={[styles.lessonSubject, {fontSize: Math.max(7, Math.min(9, dayWidth * 0.15)), color: colors.secondary}]}>
                    {lesson.teacher}
                  </Text>
                ) : null}
              </View>
            );
          })
        ) : (
          <View style={[styles.emptySchedule, {borderColor: colors.border, backgroundColor: colors.panel}]}>
            <Text style={[styles.emptyTitle, {color: colors.primary}]}>학급 시간표가 없습니다</Text>
            <Text style={[styles.emptyHint, {color: colors.secondary}]}>아래로 당겨 새로고침하세요.</Text>
          </View>
        )}
        {renderLegend('')}
      </>
    );
  };

  const renderTodaySchedule = () => (
    <>
      <View style={[styles.todayHeader, {borderTopColor: colors.border}]}>
        <Text style={[styles.todayTitle, {color: colors.primary}]}>
          {todayIndex >= 0 ? dateLabel(days[todayIndex]) : '오늘'} 수업
        </Text>
        <Text style={[styles.todayCount, {color: colors.secondary}]}>{todayMatches.length}개 수업</Text>
      </View>
      {todayMatches.length ? todayMatches.map((match, index) => (
        <View key={match.periodIndex + '-' + index} style={[styles.todayRow, {borderTopColor: colors.border}]}>
          <Text style={[styles.todayPeriod, {color: colors.secondary}]}>
            {(periods[match.periodIndex] || match.periodIndex + 1) + '교시'}
          </Text>
          <Text numberOfLines={1} style={[styles.todayClass, {color: colors.primary}]}>
            {match.className || match.title || '수업'}
          </Text>
          <Text numberOfLines={1} style={[styles.todaySubject, {color: colors.secondary}]}>
            {match.title || ''}
          </Text>
          <Text style={[styles.todayTime, {color: colors.secondary}]}>{START_TIMES[match.periodIndex]}</Text>
        </View>
      )) : (
        <Text style={[styles.todayEmpty, {color: colors.secondary}]}>오늘 예정된 수업이 없습니다.</Text>
      )}
    </>
  );

  return (
    <SafeAreaView style={[styles.safeArea, {backgroundColor: colors.background}]}>
      <StatusBar barStyle={settings.theme === 'dark' ? 'light-content' : 'dark-content'} />
      <View style={styles.screen}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={activeTab === '시간표' ? classLoading && !!classSchedule : refreshing}
              onRefresh={() => (activeTab === '시간표' ? loadClassSchedule() : refresh())}
              tintColor={colors.accent}
            />
          }>
          <View style={[styles.topBar, {borderBottomColor: colors.border}]}>
            <Text style={[styles.brand, {color: colors.primary}]}>용정시간표</Text>
            <Pressable
              accessibilityRole="button"
              onPress={toggleTheme}
              style={[styles.themeButton, {borderColor: colors.border}]}>
              <Text style={[styles.themeButtonText, {color: colors.secondary}]}>
                {settings.theme === 'dark' ? '라이트 모드' : '다크 모드'}
              </Text>
            </Pressable>
          </View>

          <View style={styles.heading}>
            <View style={styles.headingCopy}>
              <Text style={[styles.pageTitle, {color: colors.primary}]}>
                {activeTab === '시간표' ? '학급 시간표' : '교사 보기'}
              </Text>
              <Text numberOfLines={1} style={[styles.subtitle, {color: colors.secondary}]}>
                {activeTab === '시간표'
                  ? (selectedClass ? selectedClass + '반 · ' : '') + '이번 주 시간표'
                  : teacherTitle + ' · ' + subjectSummary + ' · 주간 ' + weeklyHours + '시간'}
              </Text>
            </View>
            {activeTab === '시간표' ? null : (
            <Pressable
              accessibilityRole="button"
              onPress={openTeacherModal}
              style={[styles.teacherPicker, {borderColor: colors.accent}]}>
              <Text numberOfLines={1} style={[styles.teacherPickerText, {color: colors.primary}]}>
                {teacherTitle + ' (' + (subjects[0] || '교사') + ')'}
              </Text>
              <Text style={[styles.chevron, {color: colors.secondary}]}>⌄</Text>
            </Pressable>
            )}
          </View>

          {activeTab === '시간표' ? renderClassPage() : (
          <>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {loading && !schedule ? (
            <View style={styles.loading}>
              <ActivityIndicator color={colors.accent} />
              <Text style={[styles.loadingText, {color: colors.secondary}]}>시간표 불러오는 중</Text>
            </View>
          ) : days.length > 0 ? (
              renderWeekGrid(days, periods, (dayIndex, periodIndex) => {
                const matches = schedule?.grid?.[dayIndex]?.[periodIndex] || [];
                return matches.length ? matches.map((match, matchIndex) => (
                  <View
                    key={match.className + '-' + matchIndex}
                    style={[
                      styles.lessonCard,
                      {borderLeftColor: lessonColor(match.type, colors), backgroundColor: lessonBackground(match.type)},
                    ]}>
                    <Text numberOfLines={1} style={[styles.lessonClass, {fontSize: Math.max(9, Math.min(12, dayWidth * 0.2)), color: colors.primary}]}>
                      {match.className || match.title || '수업'}
                    </Text>
                    {match.note ? (
                      <Text numberOfLines={1} style={[styles.lessonNote, {fontSize: Math.max(7, Math.min(9, dayWidth * 0.15)), color: lessonColor(match.type, colors)}]}>
                        {match.note}
                      </Text>
                    ) : null}
                    {match.className && match.title ? (
                      <Text numberOfLines={1} style={[styles.lessonSubject, {fontSize: Math.max(7, Math.min(9, dayWidth * 0.15)), color: colors.secondary}]}>
                        {match.title}
                      </Text>
                    ) : null}
                  </View>
                )) : <Text style={[styles.emptyMark, {color: colors.muted}]}>·</Text>;
              })
          ) : (
            <View style={[styles.emptySchedule, {borderColor: colors.border, backgroundColor: colors.panel}]}>
              <Text style={[styles.emptyTitle, {color: colors.primary}]}>주간 시간표가 없습니다</Text>
              <Text style={[styles.emptyHint, {color: colors.secondary}]}>교사 이름을 확인하고 아래로 당겨 새로고침하세요.</Text>
            </View>
          )}

          {renderLegend('가운데점은 공강입니다')}
          {renderTodaySchedule()}
          </>
          )}
        </ScrollView>

        <View style={[styles.bottomNav, {borderTopColor: colors.border, backgroundColor: colors.background}]}>
          {['시간표', '교사 보기', '다운로드'].map(tab => (
            <Pressable key={tab} accessibilityRole="button" onPress={() => pressTab(tab)} style={styles.navItem}>
              <View style={[styles.navIndicator, {backgroundColor: activeTab === tab ? colors.accent : 'transparent'}]} />
              <Text style={[styles.navText, {color: activeTab === tab ? colors.primary : colors.secondary}]}>{tab}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <Modal
        transparent
        animationType="fade"
        visible={teacherModalVisible}
        onRequestClose={() => {
          if (!firstRun) setTeacherModalVisible(false);
        }}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, {backgroundColor: colors.panel, borderColor: colors.border}]}>
            <Text style={[styles.modalTitle, {color: colors.primary}]}>교사 선택</Text>
            <Text style={[styles.modalHint, {color: colors.secondary}]}>
              {firstRun
                ? '시간표를 볼 교사를 선택하세요. 나중에 상단에서 바꿀 수 있습니다.'
                : '시간표를 볼 교사를 선택하세요.'}
            </Text>
            <TextInput
              value={teacherDraft}
              onChangeText={setTeacherDraft}
              placeholder="이름 또는 과목 검색"
              placeholderTextColor={colors.muted}
              returnKeyType="search"
              style={[styles.teacherInput, {borderColor: colors.border, color: colors.primary}]}
            />
            <ScrollView style={styles.teacherList} keyboardShouldPersistTaps="handled">
              {teacherListLoading ? (
                <View style={styles.teacherListState}>
                  <ActivityIndicator color={colors.accent} />
                </View>
              ) : teacherListError ? (
                <View style={styles.teacherListState}>
                  <Text style={styles.error}>{teacherListError}</Text>
                  <Pressable onPress={loadTeacherOptions} style={[styles.retryButton, {borderColor: colors.border}]}>
                    <Text style={[styles.cancelText, {color: colors.primary}]}>다시 시도</Text>
                  </Pressable>
                </View>
              ) : filteredTeachers.length ? filteredTeachers.map(teacher => {
                const selected = !firstRun && teacher.name === settings.name;
                return (
                  <Pressable
                    key={teacher.name}
                    accessibilityRole="button"
                    onPress={() => saveTeacher(teacher.name)}
                    style={[
                      styles.teacherOption,
                      {borderBottomColor: colors.border},
                      selected ? {backgroundColor: colors.accent + '22'} : null,
                    ]}>
                    <Text style={[styles.teacherOptionName, {color: colors.primary}]}>{teacher.label}</Text>
                    <Text numberOfLines={1} style={[styles.teacherOptionSubjects, {color: colors.secondary}]}>
                      {teacher.subjects.join(' · ')}
                    </Text>
                    {selected ? <Text style={[styles.teacherOptionCheck, {color: colors.accent}]}>✓</Text> : null}
                  </Pressable>
                );
              }) : (
                <Text style={[styles.todayEmpty, {color: colors.secondary}]}>
                  {teacherOptions.length ? '검색 결과가 없습니다.' : '등록된 교사가 없습니다.'}
                </Text>
              )}
            </ScrollView>
            {firstRun ? null : (
              <View style={styles.modalActions}>
                <Pressable onPress={() => setTeacherModalVisible(false)} style={styles.modalAction}>
                  <Text style={[styles.cancelText, {color: colors.secondary}]}>닫기</Text>
                </Pressable>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function LegendItem({label, color, textColor}: {label: string; color: string; textColor: string}) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendMarker, {backgroundColor: color}]} />
      <Text style={[styles.legendText, {color: textColor}]}>{label}</Text>
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AppContent />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {flex: 1},
  screen: {flex: 1},
  scroll: {flex: 1},
  content: {paddingHorizontal: 16, paddingBottom: 12},
  topBar: {
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  brand: {fontSize: 16, fontWeight: '700'},
  themeButton: {paddingHorizontal: 11, paddingVertical: 7, borderWidth: 1, borderRadius: 8},
  themeButtonText: {fontSize: 12, fontWeight: '600'},
  heading: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 16, paddingBottom: 14},
  headingCopy: {flex: 1, minWidth: 0, marginRight: 8},
  pageTitle: {fontSize: 21, lineHeight: 27, fontWeight: '800'},
  subtitle: {fontSize: 12, marginTop: 2},
  teacherPicker: {
    alignSelf: 'center',
    minWidth: 135,
    maxWidth: '42%',
    height: 38,
    paddingHorizontal: 11,
    borderWidth: 2,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  teacherPickerText: {fontSize: 13, fontWeight: '700', flexShrink: 1},
  chevron: {fontSize: 15, marginTop: -4},
  grid: {gap: 1, padding: 1},
  gridRow: {flexDirection: 'row', gap: 1, minHeight: 60},
  headerGridRow: {height: 38, minHeight: 38},
  cornerCell: {height: 38, alignItems: 'center', justifyContent: 'center'},
  dayHeader: {height: 38, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3},
  headerText: {fontSize: 12, fontWeight: '700'},
  dayDate: {fontSize: 12, fontWeight: '700'},
  periodCell: {minHeight: 60, alignItems: 'center', justifyContent: 'center', paddingVertical: 3},
  periodNumber: {fontSize: 11, fontWeight: '700'},
  periodTime: {fontSize: 10, lineHeight: 13},
  lessonCell: {minHeight: 60, padding: 3, alignItems: 'stretch', justifyContent: 'center'},
  lessonCard: {minHeight: 48, flex: 1, justifyContent: 'center', alignItems: 'center', borderLeftWidth: 2, paddingHorizontal: 3},
  lessonClass: {fontSize: 12, fontWeight: '800', textAlign: 'center'},
  lessonNote: {fontSize: 9, marginTop: 3, textAlign: 'center'},
  lessonSubject: {fontSize: 9, marginTop: 2, textAlign: 'center'},
  emptyMark: {fontSize: 13, textAlign: 'center'},
  loading: {height: 250, alignItems: 'center', justifyContent: 'center', gap: 10},
  loadingText: {fontSize: 13},
  emptySchedule: {minHeight: 150, borderWidth: 1, borderRadius: 12, alignItems: 'center', justifyContent: 'center', padding: 20},
  classChips: {flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12},
  classChip: {minWidth: 52, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderRadius: 8, alignItems: 'center'},
  classChipText: {fontSize: 13, fontWeight: '700'},
  emptyTitle: {fontSize: 15, fontWeight: '700'},
  emptyHint: {fontSize: 12, marginTop: 8, textAlign: 'center'},
  legend: {flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10, paddingVertical: 12},
  legendItem: {flexDirection: 'row', alignItems: 'center', gap: 5},
  legendMarker: {width: 2, height: 12},
  legendText: {fontSize: 10},
  legendNote: {fontSize: 10},
  todayHeader: {minHeight: 44, borderTopWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 1},
  todayTitle: {fontSize: 13, fontWeight: '800'},
  todayCount: {fontSize: 11},
  todayRow: {minHeight: 40, borderTopWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'center', gap: 8},
  todayPeriod: {width: 42, fontSize: 11},
  todayClass: {width: 44, fontSize: 12, fontWeight: '700'},
  todaySubject: {flex: 1, fontSize: 11},
  todayTime: {fontSize: 11},
  todayEmpty: {fontSize: 12, paddingVertical: 12},
  bottomNav: {height: 56, borderTopWidth: StyleSheet.hairlineWidth, flexDirection: 'row'},
  navItem: {flex: 1, alignItems: 'center', justifyContent: 'center'},
  navIndicator: {position: 'absolute', top: 0, height: 2, width: '80%'},
  navText: {fontSize: 11},
  error: {fontSize: 12, color: '#C76464', marginBottom: 8},
  modalBackdrop: {flex: 1, backgroundColor: '#0009', alignItems: 'center', justifyContent: 'center', padding: 22},
  modalCard: {width: '100%', borderWidth: 1, borderRadius: 16, padding: 18},
  modalTitle: {fontSize: 17, fontWeight: '800'},
  modalHint: {fontSize: 12, marginTop: 6, lineHeight: 17},
  teacherList: {maxHeight: 360, marginTop: 10},
  teacherListState: {minHeight: 120, alignItems: 'center', justifyContent: 'center', gap: 10},
  retryButton: {paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderRadius: 8},
  teacherOption: {minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 6, borderBottomWidth: StyleSheet.hairlineWidth},
  teacherOptionName: {fontSize: 15, fontWeight: '700'},
  teacherOptionSubjects: {flex: 1, fontSize: 12},
  teacherOptionCheck: {fontSize: 15, fontWeight: '800'},
  teacherInput: {height: 46, borderWidth: 1, borderRadius: 9, paddingHorizontal: 12, marginTop: 16, fontSize: 15},
  modalActions: {flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 10, marginTop: 16},
  modalAction: {paddingHorizontal: 13, paddingVertical: 10},
  cancelText: {fontSize: 13, fontWeight: '600'},
});
