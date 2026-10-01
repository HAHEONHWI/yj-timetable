import React, {useCallback, useEffect, useState} from 'react';
import {
  ActivityIndicator,
  AppState,
  Linking,
  Modal,
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
import {SafeAreaView} from 'react-native-safe-area-context';
import {
  AcademicCalendar,
  ApiSchedule,
  ClassSchedule,
  DEFAULT_SETTINGS,
  Legend,
  MealView,
  NotificationSettings,
  NotificationSettingsModal,
  PALETTES,
  START_TIMES,
  Settings,
  TeacherOption,
  WeekGrid,
  WidgetSettings,
  classScheduleUrl,
  dateLabel,
  ensureNotificationPermission,
  lessonBackground,
  lessonColor,
  minutesNowInKorea,
  styles,
  teacherListUrl,
  teacherScheduleUrl,
  todayInKorea,
  UpdatePrompt,
} from './src/shared';

export default function TeacherApp() {
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
  const [academicRefresh, setAcademicRefresh] = useState(0);
  const [mealRefresh, setMealRefresh] = useState(0);
  const [classSchedule, setClassSchedule] = useState<ClassSchedule | null>(null);
  const [selectedClass, setSelectedClass] = useState('');
  const [classLoading, setClassLoading] = useState(false);
  const [classError, setClassError] = useState('');
  const [notifySettings, setNotifySettings] = useState<NotificationSettings>({changes: false, daily: false, setupDone: true});
  const [notifyDraft, setNotifyDraft] = useState({changes: true, daily: true});
  const [settingsModal, setSettingsModal] = useState<'' | 'setup' | 'edit'>('');
  const [notifyPermissionDenied, setNotifyPermissionDenied] = useState(false);
  const colors = PALETTES[settings.theme];
  const days = schedule?.days || [];
  const periods = schedule?.periods || START_TIMES.map((_, index) => index + 1);
  const todayIndex = days.findIndex(day => day.iso === todayInKorea());
  const todayGrid = todayIndex >= 0 ? schedule?.grid?.[todayIndex] || [] : [];
  const todayMatches = todayGrid.flatMap((matches, periodIndex) =>
    matches.map(match => ({...match, periodIndex})),
  );
  const weeklyHours = (schedule?.grid || []).reduce(
    (total, day) => total + day.filter(matches => matches.length > 0).length,
    0,
  );
  // 서버가 교과 변경·신설로 표시한 이번 주 수업. 알림을 꺼 두어도 여기서 확인할 수 있다.
  const changedLessons = days.flatMap((day, dayIndex) =>
    (schedule?.grid?.[dayIndex] || []).flatMap((matches, periodIndex) =>
      matches
        .filter(match => match.type === 'change' || match.type === 'new')
        .map(match => ({...match, day, periodIndex})),
    ),
  );
  const subjects = [...new Set((schedule?.grid || []).flat(2).map(match => match.title).filter(Boolean))];
  const subjectSummary = subjects.slice(0, 2).join(' · ') || '교사 시간표';
  const gridWidth = Math.max(0, screenWidth - 32);

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

  const loadNotificationSettings = useCallback(async () => {
    try {
      const saved = await WidgetSettings.getNotificationSettings();
      setNotifySettings(saved);
      if (saved.setupDone) {
        WidgetSettings.syncNotifications();
      } else {
        setNotifyDraft({changes: true, daily: true});
        setSettingsModal('setup');
      }
    } catch {
      // 알림 설정을 못 읽어도 시간표는 계속 보여 준다.
    }
  }, []);

  const loadInitialData = useCallback(async () => {
    const saved = await loadSettings();
    if (saved.teacherSelected !== false) loadNotificationSettings();
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
  }, [loadNotificationSettings, loadSettings, openTeacherModal, refresh]);

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
    const wasFirstRun = firstRun;
    setFirstRun(false);
    setTeacherModalVisible(false);
    if (wasFirstRun) loadNotificationSettings();
    await refresh(next);
  };

  const saveNotificationSettings = async (next: {changes: boolean; daily: boolean}) => {
    const granted = next.changes || next.daily ? await ensureNotificationPermission() : true;
    setNotifyPermissionDenied(!granted);
    await WidgetSettings.setNotificationSettings(next.changes, next.daily);
    setNotifySettings({...next, setupDone: true});
    setNotifyDraft(next);
    return granted;
  };

  const finishNotificationSetup = async () => {
    const granted = await saveNotificationSettings(notifyDraft);
    if (granted) setSettingsModal('');
  };

  const toggleNotification = async (key: 'changes' | 'daily', value: boolean) => {
    const next = {...notifyDraft, [key]: value};
    setNotifyDraft(next);
    if (settingsModal === 'edit') await saveNotificationSettings(next);
  };

  const openSettings = () => {
    setNotifyDraft({changes: notifySettings.changes, daily: notifySettings.daily});
    setNotifyPermissionDenied(false);
    setSettingsModal('edit');
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
          <WeekGrid colors={colors} width={gridWidth} clock={clock} days={classDays} periods={classPeriods} renderCell={(dayIndex, periodIndex, dayWidth) => {
            const lesson = table[dayIndex]?.[periodIndex];
            if (!lesson?.title) return <Text style={[styles.emptyMark, {color: colors.muted}]}>·</Text>;
            return (
              <View
                style={[
                  styles.lessonCard,
                  {borderLeftColor: lessonColor(lesson.type, colors), backgroundColor: lessonBackground(lesson.type, colors)},
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
          }} />
        ) : (
          <View style={[styles.emptySchedule, {borderColor: colors.border, backgroundColor: colors.panel}]}>
            <Text style={[styles.emptyTitle, {color: colors.primary}]}>학급 시간표가 없습니다</Text>
            <Text style={[styles.emptyHint, {color: colors.secondary}]}>아래로 당겨 새로고침하세요.</Text>
          </View>
        )}
        {<Legend colors={colors} note="" />}
      </>
    );
  };

  const renderChangedLessons = () => (
    <>
      <View style={[styles.todayHeader, {borderTopColor: colors.border}]}>
        <Text style={[styles.todayTitle, {color: colors.primary}]}>이번 주 교과 변경</Text>
        <Text style={[styles.todayCount, {color: colors.secondary}]}>{changedLessons.length}건</Text>
      </View>
      {changedLessons.length ? changedLessons.map((lesson, index) => {
        const past = lesson.day.iso < todayInKorea();
        return (
          <View key={lesson.day.iso + '-' + lesson.periodIndex + '-' + index} style={[styles.todayRow, {borderTopColor: colors.border}, past && local.past]}>
            <View style={[local.changeMarker, {backgroundColor: lessonColor(lesson.type, colors)}]} />
            <Text style={[local.changeDay, {color: colors.secondary}]}>
              {dateLabel(lesson.day) + ' ' + (periods[lesson.periodIndex] || lesson.periodIndex + 1) + '교시'}
            </Text>
            <Text numberOfLines={1} style={[styles.todayClass, {color: colors.primary}]}>
              {lesson.className || lesson.title || '수업'}
            </Text>
            <Text numberOfLines={1} style={[styles.todaySubject, {color: colors.secondary}]}>
              {lesson.className ? lesson.title || '' : ''}
            </Text>
            <Text style={[styles.todayTime, {color: lessonColor(lesson.type, colors)}]}>
              {lesson.note || (lesson.type === 'new' ? '신설' : '변경')}
            </Text>
          </View>
        );
      }) : (
        <Text style={[styles.todayEmpty, {color: colors.secondary}]}>이번 주 변경된 수업이 없습니다.</Text>
      )}
    </>
  );

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
              refreshing={activeTab === '시간표' ? classLoading && !!classSchedule : activeTab === '교사 보기' ? refreshing : false}
              onRefresh={() => {
                if (activeTab === '시간표') loadClassSchedule();
                else if (activeTab === '급식') setMealRefresh(value => value + 1);
                else if (activeTab === '학사일정') setAcademicRefresh(value => value + 1);
                else refresh();
              }}
              tintColor={colors.accent}
            />
          }>
          <View style={[styles.topBar, {borderBottomColor: colors.border}]}>
            <Text style={[styles.brand, {color: colors.primary}]}>용정시간표</Text>
            <View style={styles.topActions}>
              <Pressable
                accessibilityRole="button"
                onPress={toggleTheme}
                style={[styles.themeButton, {borderColor: colors.border}]}>
                <Text style={[styles.themeButtonText, {color: colors.secondary}]}>
                  {settings.theme === 'dark' ? '라이트 모드' : '다크 모드'}
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={openSettings}
                style={[styles.themeButton, {borderColor: colors.border}]}>
                <Text style={[styles.themeButtonText, {color: colors.secondary}]}>설정</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.heading}>
            <View style={styles.headingCopy}>
              <Text style={[styles.pageTitle, {color: colors.primary}]}>
                {activeTab === '시간표' ? '학급 시간표' : activeTab === '학사일정' ? '학사일정' : activeTab === '급식' ? '급식' : '교사 보기'}
              </Text>
              <Text numberOfLines={1} style={[styles.subtitle, {color: colors.secondary}]}>
                {activeTab === '시간표'
                  ? (selectedClass ? selectedClass + '반 · ' : '') + '이번 주 시간표'
                  : activeTab === '학사일정'
                    ? '시험, 행사, 휴업일과 다가오는 일정'
                    : activeTab === '급식'
                    ? '용정중학교 급식'
                    : firstRun
                    ? '시간표를 볼 교사를 선택하세요'
                    : teacherTitle + ' · ' + subjectSummary + ' · 주간 ' + weeklyHours + '시간'}
              </Text>
            </View>
            {activeTab !== '교사 보기' ? null : (
            <Pressable
              accessibilityRole="button"
              onPress={openTeacherModal}
              style={[styles.teacherPicker, {borderColor: colors.accent}]}>
              <Text numberOfLines={1} style={[styles.teacherPickerText, {color: colors.primary}]}>
                {firstRun ? teacherTitle : teacherTitle + ' (' + (subjects[0] || '교사') + ')'}
              </Text>
              <Text style={[styles.chevron, {color: colors.secondary}]}>⌄</Text>
            </Pressable>
            )}
          </View>

          {activeTab === '급식' ? (
            <MealView colors={colors} refreshKey={mealRefresh} />
          ) : activeTab === '학사일정' ? (
            <AcademicCalendar colors={colors} refreshKey={academicRefresh} />
          ) : activeTab === '시간표' ? renderClassPage() : (
          <>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {loading && !schedule ? (
            <View style={styles.loading}>
              <ActivityIndicator color={colors.accent} />
              <Text style={[styles.loadingText, {color: colors.secondary}]}>시간표 불러오는 중</Text>
            </View>
          ) : days.length > 0 ? (
              <WeekGrid colors={colors} width={gridWidth} clock={clock} days={days} periods={periods} renderCell={(dayIndex, periodIndex, dayWidth) => {
                const matches = schedule?.grid?.[dayIndex]?.[periodIndex] || [];
                return matches.length ? matches.map((match, matchIndex) => (
                  <View
                    key={match.className + '-' + matchIndex}
                    style={[
                      styles.lessonCard,
                      {borderLeftColor: lessonColor(match.type, colors), backgroundColor: lessonBackground(match.type, colors)},
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
              }} />
          ) : (
            <View style={[styles.emptySchedule, {borderColor: colors.border, backgroundColor: colors.panel}]}>
              <Text style={[styles.emptyTitle, {color: colors.primary}]}>주간 시간표가 없습니다</Text>
              <Text style={[styles.emptyHint, {color: colors.secondary}]}>교사 이름을 확인하고 아래로 당겨 새로고침하세요.</Text>
            </View>
          )}

          <Legend colors={colors} note="가운데점은 공강입니다" />
          {renderChangedLessons()}
          {renderTodaySchedule()}
          </>
          )}
        </ScrollView>

        <View style={[styles.bottomNav, {borderTopColor: colors.border, backgroundColor: colors.background}]}>
          {['시간표', '교사 보기', '급식', '학사일정', '다운로드'].map(tab => (
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

      <NotificationSettingsModal
        colors={colors}
        mode={settingsModal}
        hidden={teacherModalVisible}
        draft={notifyDraft}
        permissionDenied={notifyPermissionDenied}
        changeHint="내 수업이 바뀌거나 새로 생기면 알려 드려요"
        dailyHint="평일 매일 오전 8시에 오늘 수업을 알려 드려요"
        targetLabel="교사"
        targetValue={settings.name}
        onChangeTarget={openTeacherModal}
        onToggle={toggleNotification}
        onFinish={finishNotificationSetup}
        onClose={() => setSettingsModal('')}
      />

      <UpdatePrompt colors={colors} hidden={teacherModalVisible || settingsModal !== ''} />
    </SafeAreaView>
  );
}

const local = StyleSheet.create({
  past: {opacity: 0.5},
  changeMarker: {width: 3, height: 18, borderRadius: 2},
  changeDay: {width: 82, fontSize: 11},
});
