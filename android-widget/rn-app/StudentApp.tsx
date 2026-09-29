import React, {useCallback, useEffect, useState} from 'react';
import {
  ActivityIndicator,
  AppState,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {
  AcademicCalendar,
  ClassSchedule,
  DEFAULT_SETTINGS,
  Legend,
  NotificationSettings,
  NotificationSettingsModal,
  PALETTES,
  START_TIMES,
  Settings,
  WeekGrid,
  WidgetSettings,
  classScheduleUrl,
  ensureNotificationPermission,
  lessonBackground,
  lessonColor,
  mealUrl,
  minutesNowInKorea,
  styles,
  todayInKorea,
} from './src/shared';

type Meal = {
  ok?: boolean;
  targetDate?: string;
  formattedDate?: string;
  mealCode?: string;
  mealTypeLabel?: string;
  menu?: string[];
  calories?: string;
};

const FALLBACK_CLASSES = ['1-1', '1-2', '2-1', '2-2', '3-1', '3-2'];
const MEAL_CODES = [
  {code: '1', label: '아침'},
  {code: '2', label: '점심'},
  {code: '3', label: '저녁'},
];

export default function StudentApp() {
  const {width: screenWidth} = useWindowDimensions();
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [classSchedule, setClassSchedule] = useState<ClassSchedule | null>(null);
  const [classJson, setClassJson] = useState('');
  const [viewClass, setViewClass] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [clock, setClock] = useState(minutesNowInKorea);
  const [firstRun, setFirstRun] = useState(false);
  const [classModalVisible, setClassModalVisible] = useState(false);
  const [activeTab, setActiveTab] = useState<'시간표' | '급식' | '학사일정'>('시간표');
  const [academicRefresh, setAcademicRefresh] = useState(0);
  const [meal, setMeal] = useState<Meal | null>(null);
  const [mealLoading, setMealLoading] = useState(false);
  const [mealError, setMealError] = useState('');
  const [notifySettings, setNotifySettings] = useState<NotificationSettings>({changes: false, daily: false, setupDone: true});
  const [notifyDraft, setNotifyDraft] = useState({changes: true, daily: true});
  const [settingsModal, setSettingsModal] = useState<'' | 'setup' | 'edit'>('');
  const [notifyPermissionDenied, setNotifyPermissionDenied] = useState(false);
  const colors = PALETTES[settings.theme];
  const myClass = settings.name;
  const shownClass = viewClass || myClass;
  const classNames = classSchedule?.classes?.length ? classSchedule.classes : FALLBACK_CLASSES;
  const days = classSchedule?.days || [];
  const periods = classSchedule?.periods || START_TIMES.map((_, index) => index + 1);
  const table = (shownClass && classSchedule?.timetables?.[shownClass]) || [];
  const todayIndex = days.findIndex(day => day.iso === todayInKorea());
  const todayLessons = todayIndex >= 0
    ? (table[todayIndex] || [])
      .map((lesson, periodIndex) => ({...lesson, periodIndex}))
      .filter(lesson => lesson.title)
    : [];
  const gridWidth = Math.max(0, screenWidth - 32);

  const loadClassSchedule = useCallback(async (ownClass: string) => {
    setRefreshing(true);
    setError('');
    try {
      const response = await fetch(classScheduleUrl());
      if (!response.ok) throw new Error('시간표 요청 실패 (' + response.status + ')');
      const json = await response.text();
      setClassSchedule(JSON.parse(json) as ClassSchedule);
      setClassJson(json);
      if (ownClass) await WidgetSettings.cacheClassSchedule(json, ownClass);
    } catch (err) {
      setError(err instanceof Error ? err.message : '시간표를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const loadMeal = useCallback(async (date?: string, mealCode?: string) => {
    setMealLoading(true);
    setMealError('');
    try {
      const response = await fetch(mealUrl(date, mealCode));
      if (!response.ok) throw new Error('급식 요청 실패 (' + response.status + ')');
      setMeal(await response.json() as Meal);
    } catch (err) {
      setMealError(err instanceof Error ? err.message : '급식 정보를 불러오지 못했습니다.');
    } finally {
      setMealLoading(false);
    }
  }, []);

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
    let saved = DEFAULT_SETTINGS;
    try {
      saved = {...DEFAULT_SETTINGS, ...await WidgetSettings.getSettings()};
    } catch {
      // 기본값으로 계속한다.
    }
    setSettings(saved);
    if (!saved.name) {
      setFirstRun(true);
      setClassModalVisible(true);
    } else {
      loadNotificationSettings();
    }
    await loadClassSchedule(saved.name);
  }, [loadClassSchedule, loadNotificationSettings]);

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

  // 학생용은 네이티브 "name" 설정에 우리 반(예: 2-1)을 저장한다.
  const saveClass = async (className: string) => {
    const saved = await WidgetSettings.setTeacherName(className);
    setSettings({...settings, name: saved});
    setViewClass('');
    const wasFirstRun = firstRun;
    setFirstRun(false);
    setClassModalVisible(false);
    if (classJson) await WidgetSettings.cacheClassSchedule(classJson, saved);
    if (wasFirstRun) loadNotificationSettings();
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

  const pressTab = (tab: '시간표' | '급식' | '학사일정') => {
    setActiveTab(tab);
    if (tab === '급식' && !meal && !mealLoading) loadMeal();
  };

  const renderTimetable = () => (
    <>
      <View style={styles.classChips}>
        {classNames.map(className => {
          const active = className === shownClass;
          return (
            <Pressable
              key={className}
              accessibilityRole="button"
              onPress={() => setViewClass(className === myClass ? '' : className)}
              style={[
                styles.classChip,
                {borderColor: active ? colors.accent : colors.border, backgroundColor: active ? colors.accent + '22' : colors.panel},
              ]}>
              <Text style={[styles.classChipText, {color: active ? colors.primary : colors.secondary}]}>
                {className === myClass ? className + ' ★' : className}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {loading && !classSchedule ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.accent} />
          <Text style={[styles.loadingText, {color: colors.secondary}]}>시간표 불러오는 중</Text>
        </View>
      ) : days.length && table.length ? (
        <WeekGrid
          colors={colors}
          width={gridWidth}
          clock={clock}
          days={days}
          periods={periods}
          renderCell={(dayIndex, periodIndex, cellWidth) => {
            const lesson = table[dayIndex]?.[periodIndex];
            if (!lesson?.title) return <Text style={[styles.emptyMark, {color: colors.muted}]}>·</Text>;
            return (
              <View
                style={[
                  styles.lessonCard,
                  {borderLeftColor: lessonColor(lesson.type, colors), backgroundColor: lessonBackground(lesson.type, colors)},
                ]}>
                <Text numberOfLines={2} style={[styles.lessonClass, {fontSize: Math.max(9, Math.min(12, cellWidth * 0.2)), color: colors.primary}]}>
                  {lesson.title}
                </Text>
                {lesson.teacher ? (
                  <Text numberOfLines={1} style={[styles.lessonSubject, {fontSize: Math.max(7, Math.min(9, cellWidth * 0.15)), color: colors.secondary}]}>
                    {lesson.teacher}
                  </Text>
                ) : null}
              </View>
            );
          }}
        />
      ) : (
        <View style={[styles.emptySchedule, {borderColor: colors.border, backgroundColor: colors.panel}]}>
          <Text style={[styles.emptyTitle, {color: colors.primary}]}>시간표가 없습니다</Text>
          <Text style={[styles.emptyHint, {color: colors.secondary}]}>아래로 당겨 새로고침하세요.</Text>
        </View>
      )}
      <Legend colors={colors} note="★ 우리 반" />
      <View style={[styles.todayHeader, {borderTopColor: colors.border}]}>
        <Text style={[styles.todayTitle, {color: colors.primary}]}>오늘 수업</Text>
        <Text style={[styles.todayCount, {color: colors.secondary}]}>{todayLessons.length}교시</Text>
      </View>
      {todayLessons.length ? todayLessons.map(lesson => (
        <View key={lesson.periodIndex} style={[styles.todayRow, {borderTopColor: colors.border}]}>
          <Text style={[styles.todayPeriod, {color: colors.secondary}]}>{periods[lesson.periodIndex]}교시</Text>
          <Text numberOfLines={1} style={[local.todaySubject, {color: colors.primary}]}>{lesson.title}</Text>
          <Text numberOfLines={1} style={[styles.todaySubject, {color: colors.secondary}]}>{lesson.teacher || ''}</Text>
          <Text style={[styles.todayTime, {color: colors.secondary}]}>{START_TIMES[lesson.periodIndex]}</Text>
        </View>
      )) : (
        <Text style={[styles.todayEmpty, {color: colors.secondary}]}>오늘 예정된 수업이 없습니다.</Text>
      )}
    </>
  );

  const renderMeal = () => (
    <>
      <View style={styles.classChips}>
        {MEAL_CODES.map(item => {
          const active = meal?.mealCode === item.code;
          return (
            <Pressable
              key={item.code}
              accessibilityRole="button"
              onPress={() => loadMeal(meal?.targetDate, item.code)}
              style={[
                styles.classChip,
                {borderColor: active ? colors.accent : colors.border, backgroundColor: active ? colors.accent + '22' : colors.panel},
              ]}>
              <Text style={[styles.classChipText, {color: active ? colors.primary : colors.secondary}]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>
      {mealError ? <Text style={styles.error}>{mealError}</Text> : null}
      {mealLoading && !meal ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.accent} />
          <Text style={[styles.loadingText, {color: colors.secondary}]}>급식 불러오는 중</Text>
        </View>
      ) : meal ? (
        <View style={[local.mealCard, {borderColor: colors.border, backgroundColor: colors.panel}]}>
          <Text style={[local.mealLabel, {color: colors.secondary}]}>{meal.formattedDate}</Text>
          <Text style={[local.mealTitle, {color: colors.primary}]}>{meal.mealTypeLabel}</Text>
          {meal.menu?.length ? meal.menu.map((item, index) => (
            <Text key={item + index} style={[local.mealItem, {color: colors.primary, borderTopColor: colors.border}]}>{item}</Text>
          )) : (
            <Text style={[styles.todayEmpty, {color: colors.secondary}]}>급식 정보가 없습니다.</Text>
          )}
          {meal.calories ? <Text style={[local.mealLabel, {color: colors.secondary}]}>{meal.calories}</Text> : null}
        </View>
      ) : null}
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
              refreshing={activeTab === '급식' ? mealLoading && !!meal : activeTab === '학사일정' ? false : refreshing}
              onRefresh={() => {
                if (activeTab === '급식') loadMeal(meal?.targetDate, meal?.mealCode);
                else if (activeTab === '학사일정') setAcademicRefresh(value => value + 1);
                else loadClassSchedule(myClass);
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
                {activeTab === '급식' ? '오늘 급식' : activeTab === '학사일정' ? '학사일정' : shownClass && shownClass !== myClass ? shownClass + '반 시간표' : '우리 반 시간표'}
              </Text>
              <Text numberOfLines={1} style={[styles.subtitle, {color: colors.secondary}]}>
                {activeTab === '급식'
                  ? '용정중학교 급식'
                  : activeTab === '학사일정'
                    ? (myClass ? myClass + '반 기준 · ' : '') + '시험, 행사, 휴업일'
                  : myClass ? myClass + '반 · 이번 주 시간표' : '우리 반을 선택하세요'}
              </Text>
            </View>
          </View>

          {activeTab === '급식'
            ? renderMeal()
            : activeTab === '학사일정'
              ? <AcademicCalendar colors={colors} className={myClass} refreshKey={academicRefresh} />
              : renderTimetable()}
        </ScrollView>

        <View style={[styles.bottomNav, {borderTopColor: colors.border, backgroundColor: colors.background}]}>
          {(['시간표', '급식', '학사일정'] as const).map(tab => (
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
        visible={classModalVisible}
        onRequestClose={() => {
          if (!firstRun) setClassModalVisible(false);
        }}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, {backgroundColor: colors.panel, borderColor: colors.border}]}>
            <Text style={[styles.modalTitle, {color: colors.primary}]}>우리 반 선택</Text>
            <Text style={[styles.modalHint, {color: colors.secondary}]}>
              {firstRun ? '우리 반을 고르세요. 나중에 상단 설정에서 바꿀 수 있습니다.' : '우리 반을 고르세요.'}
            </Text>
            <View style={local.classGrid}>
              {classNames.map(className => {
                const selected = className === myClass;
                return (
                  <Pressable
                    key={className}
                    accessibilityRole="button"
                    onPress={() => saveClass(className)}
                    style={[
                      local.classOption,
                      {borderColor: selected ? colors.accent : colors.border, backgroundColor: selected ? colors.accent + '22' : colors.panelStrong},
                    ]}>
                    <Text style={[local.classOptionText, {color: colors.primary}]}>{className}</Text>
                  </Pressable>
                );
              })}
            </View>
            {firstRun ? null : (
              <View style={styles.modalActions}>
                <Pressable onPress={() => setClassModalVisible(false)} style={styles.modalAction}>
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
        hidden={classModalVisible}
        draft={notifyDraft}
        permissionDenied={notifyPermissionDenied}
        changeHint="우리 반 수업이 바뀌거나 새로 생기면 알려 드려요"
        dailyHint="평일 매일 오전 8시에 오늘 시간표를 알려 드려요"
        targetLabel="우리 반"
        targetValue={myClass ? myClass + '반' : ''}
        onChangeTarget={() => setClassModalVisible(true)}
        onToggle={toggleNotification}
        onFinish={finishNotificationSetup}
        onClose={() => setSettingsModal('')}
      />
    </SafeAreaView>
  );
}

const local = StyleSheet.create({
  todaySubject: {width: 72, fontSize: 12, fontWeight: '700'},
  mealCard: {borderWidth: 1, borderRadius: 12, padding: 16},
  mealLabel: {fontSize: 12},
  mealTitle: {fontSize: 17, fontWeight: '800', marginTop: 4, marginBottom: 10},
  mealItem: {fontSize: 15, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth},
  classGrid: {flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 16},
  classOption: {width: '30%', flexGrow: 1, height: 56, borderWidth: 1, borderRadius: 10, alignItems: 'center', justifyContent: 'center'},
  classOptionText: {fontSize: 17, fontWeight: '800'},
});
