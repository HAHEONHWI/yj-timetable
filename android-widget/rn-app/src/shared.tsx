import React, {ReactNode, useCallback, useEffect, useState} from 'react';
import {
  ActivityIndicator,
  Linking,
  Modal,
  NativeModules,
  PermissionsAndroid,
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';

// 교사용과 학생용 앱이 함께 쓰는 타입, 상수, 화면 조각.

export type Settings = {
  name: string;
  subjects: string;
  grades: string;
  days: string;
  theme: 'dark' | 'light';
  teacherSelected?: boolean;
  audience?: 'teacher' | 'student';
};

export type ApiDay = {iso: string; label: string};
export type ApiMatch = {title?: string; type?: string; note?: string; className?: string};
export type ApiSchedule = {days?: ApiDay[]; periods?: number[]; grid?: ApiMatch[][][]};
export type NotificationSettings = {changes: boolean; daily: boolean; setupDone: boolean};
export type TeacherOption = {name: string; label: string; subjects: string[]};
export type ClassLesson = {title?: string; type?: string; teacher?: string};
export type ClassSchedule = {
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
  getNotificationSettings(): Promise<NotificationSettings>;
  setNotificationSettings(changes: boolean, daily: boolean): Promise<void>;
  syncNotifications(): Promise<void>;
  cacheClassSchedule(classesJson: string, className: string): Promise<string | null>;
  getAppInfo(): Promise<AppInfo>;
};

export type AppInfo = {
  versionCode: number;
  versionName: string;
  audience: 'teacher' | 'student';
  packageName: string;
  installer: string;
};
// 저장소 루트 app-version.json. 새 APK/AAB를 배포할 때 versionCode를 함께 올린다.
type AppRelease = {
  versionCode: number;
  versionName: string;
  minVersionCode?: number;
  notes?: string[];
  apkUrl?: string;
};

export const WidgetSettings = NativeModules.WidgetSettings as NativeWidgetSettings;
export const DEFAULT_SETTINGS: Settings = {
  name: '',
  subjects: '',
  grades: '',
  days: 'mon,tue,wed,thu,fri',
  theme: 'dark',
};
export const START_TIMES = ['08:40', '09:35', '10:30', '11:25', '13:20', '14:15', '15:10', '16:05', '16:55'];
export const END_TIMES = ['09:25', '10:20', '11:15', '12:10', '14:05', '15:00', '15:55', '16:45', '17:35'];
export const PALETTES = {
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

export function todayInKorea() {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function minutesNowInKorea() {
  const koreaTime = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return koreaTime.getUTCHours() * 60 + koreaTime.getUTCMinutes();
}

export function toMinutes(value: string) {
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

export function teacherScheduleUrl(name: string) {
  const params: [string, string][] = [
    ['format', 'json'],
    ['teacher', name],
    ['v', String(Date.now())],
  ];
  return 'https://schedule.yjms.kr/wallpaper.png?' + params
    .map(([key, value]) => encodeURIComponent(key) + '=' + encodeURIComponent(value))
    .join('&');
}

export async function ensureNotificationPermission() {
  if (Platform.OS !== 'android' || Number(Platform.Version) < 33) return true;
  const permission = PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS;
  if (await PermissionsAndroid.check(permission)) return true;
  return (await PermissionsAndroid.request(permission)) === PermissionsAndroid.RESULTS.GRANTED;
}

export function classScheduleUrl() {
  return 'https://schedule.yjms.kr/wallpaper.png?format=classes&v=' + Date.now();
}

export function teacherListUrl() {
  return 'https://schedule.yjms.kr/wallpaper.png?format=teachers&v=' + Date.now();
}

export function appVersionUrl() {
  return 'https://schedule.yjms.kr/app-version.json?v=' + Date.now();
}

export function dateNumber(iso: string) {
  return Number(iso.slice(-2));
}

export function dateLabel(day: ApiDay) {
  return dateNumber(day.iso) + ' ' + day.label;
}

export function firstRemainingPeriod(now: number) {
  for (let index = 0; index < END_TIMES.length; index += 1) {
    if (now <= toMinutes(END_TIMES[index])) return index;
  }
  return END_TIMES.length;
}

export function lessonColor(type: string | undefined, colors: typeof PALETTES.dark) {
  if (type === 'new') return colors.added;
  if (type === 'change') return colors.change;
  if (type === 'event') return colors.event;
  return colors.border;
}

export type Palette = typeof PALETTES.dark;

export function mealUrl(date?: string, mealCode?: string) {
  const params = ['v=' + Date.now()];
  if (date) params.push('date=' + date);
  if (mealCode) params.push('mealCode=' + mealCode);
  return 'https://schedule.yjms.kr/api/meal?' + params.join('&');
}

export type AcademicEvent = {date: string; title: string; detail: string; holiday: boolean};
type AcademicResponse = {month: string; today: string; events: AcademicEvent[]; upcoming: AcademicEvent[]};

export function academicUrl(month: string, className?: string) {
  const params = ['format=academic', 'month=' + month, 'v=' + Date.now()];
  if (className) params.push('class=' + encodeURIComponent(className));
  return 'https://schedule.yjms.kr/wallpaper.png?' + params.join('&');
}

const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

function isoDate(year: number, month: number, day: number) {
  return year + '-' + String(month).padStart(2, '0') + '-' + String(day).padStart(2, '0');
}

function shiftMonthKey(month: string, delta: number) {
  const [year, monthNumber] = month.split('-').map(Number);
  const date = new Date(Date.UTC(year, monthNumber - 1 + delta, 1));
  return date.getUTCFullYear() + '-' + String(date.getUTCMonth() + 1).padStart(2, '0');
}

function weekdayOf(iso: string) {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

function daysUntil(from: string, to: string) {
  const toUtc = (iso: string) => {
    const [year, month, day] = iso.split('-').map(Number);
    return Date.UTC(year, month - 1, day);
  };
  return Math.round((toUtc(to) - toUtc(from)) / 86400000);
}

function shortDate(iso: string) {
  return Number(iso.slice(5, 7)) + '/' + Number(iso.slice(8, 10)) + ' (' + WEEKDAY_LABELS[weekdayOf(iso)] + ')';
}

type AcademicCalendarProps = {colors: Palette; className?: string; refreshKey: number};

/** 월간 학사일정: 다가오는 일정 D-day, 월 달력, 일정 목록. 교사용은 전체, 학생용은 우리 반 기준. */
export function AcademicCalendar({colors, className, refreshKey}: AcademicCalendarProps) {
  const [month, setMonth] = useState(todayInKorea().slice(0, 7));
  const [data, setData] = useState<AcademicResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(academicUrl(month, className));
      if (!response.ok) throw new Error('학사일정 요청 실패 (' + response.status + ')');
      setData(await response.json() as AcademicResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : '학사일정을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [month, className]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const today = data?.today || todayInKorea();
  const events = data?.month === month ? data.events : [];
  const [year, monthNumber] = month.split('-').map(Number);
  const firstWeekday = weekdayOf(isoDate(year, monthNumber, 1));
  const dayCount = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const cells: (string | null)[] = [
    ...Array.from({length: firstWeekday}, () => null),
    ...Array.from({length: dayCount}, (_, index) => isoDate(year, monthNumber, index + 1)),
  ];
  while (cells.length % 7) cells.push(null);
  const eventsByDate = new Map<string, AcademicEvent[]>();
  events.forEach(event => eventsByDate.set(event.date, [...(eventsByDate.get(event.date) || []), event]));

  return (
    <>
      {data?.upcoming?.length ? (
        <View style={styles.academicUpcoming}>
          {data.upcoming.map(event => (
            <View key={event.date + event.title} style={[styles.academicUpcomingItem, {borderColor: colors.border, backgroundColor: colors.panel}]}>
              <Text style={[styles.academicDday, {color: event.holiday ? colors.added : colors.accent}]}>
                D-{daysUntil(today, event.date)}
              </Text>
              <Text numberOfLines={1} style={[styles.academicUpcomingTitle, {color: colors.primary}]}>{event.title}</Text>
              <Text style={[styles.academicUpcomingDate, {color: colors.secondary}]}>{shortDate(event.date)}</Text>
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.academicMonthBar}>
        <Pressable accessibilityRole="button" onPress={() => setMonth(shiftMonthKey(month, -1))} style={[styles.retryButton, {borderColor: colors.border}]}>
          <Text style={[styles.cancelText, {color: colors.primary}]}>이전</Text>
        </Pressable>
        <Text style={[styles.academicMonthTitle, {color: colors.primary}]}>{year}년 {monthNumber}월</Text>
        <Pressable accessibilityRole="button" onPress={() => setMonth(shiftMonthKey(month, 1))} style={[styles.retryButton, {borderColor: colors.border}]}>
          <Text style={[styles.cancelText, {color: colors.primary}]}>다음</Text>
        </Pressable>
      </View>

      <View style={[styles.academicGrid, {borderColor: colors.border, backgroundColor: colors.panel}]}>
        {WEEKDAY_LABELS.map((label, index) => (
          <Text
            key={label}
            style={[styles.academicWeekday, {color: index === 0 ? colors.added : index === 6 ? colors.accent : colors.secondary}]}>
            {label}
          </Text>
        ))}
        {cells.map((iso, index) => {
          const dayEvents = iso ? eventsByDate.get(iso) || [] : [];
          const holiday = dayEvents.some(event => event.holiday) || index % 7 === 0;
          const isToday = iso === today;
          return (
            <View key={iso || 'blank-' + index} style={styles.academicCell}>
              {iso ? (
                <View style={[styles.academicDay, isToday ? {backgroundColor: colors.accent} : null]}>
                  <Text style={[styles.academicDayText, {color: isToday ? '#FFFFFF' : holiday ? colors.added : colors.primary}]}>
                    {Number(iso.slice(8, 10))}
                  </Text>
                </View>
              ) : null}
              {dayEvents.length ? (
                <View style={[styles.academicDot, {backgroundColor: dayEvents.some(event => event.holiday) ? colors.added : colors.event}]} />
              ) : null}
            </View>
          );
        })}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {loading && !data ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.accent} />
          <Text style={[styles.loadingText, {color: colors.secondary}]}>학사일정 불러오는 중</Text>
        </View>
      ) : events.length ? events.map((event, index) => (
        <View key={event.date + event.title + index} style={[styles.academicRow, {borderTopColor: colors.border}]}>
          <Text style={[styles.academicRowDate, {color: event.holiday ? colors.added : colors.secondary}]}>{shortDate(event.date)}</Text>
          <View style={styles.settingCopy}>
            <Text style={[styles.academicRowTitle, {color: event.holiday ? colors.added : colors.primary}]}>{event.title}</Text>
            {event.detail ? <Text style={[styles.settingHint, {color: colors.secondary}]}>{event.detail}</Text> : null}
          </View>
        </View>
      )) : (
        <Text style={[styles.todayEmpty, {color: colors.secondary}]}>{loading ? '불러오는 중…' : '이 달에는 학사일정이 없습니다.'}</Text>
      )}
    </>
  );
}

export function lessonBackground(type: string | undefined, colors: Palette) {
  if (type === 'change') return colors.change + '22';
  if (type === 'new') return colors.added + '22';
  if (type === 'event') return colors.event + '22';
  return colors.panel;
}

export function LegendItem({label, color, textColor}: {label: string; color: string; textColor: string}) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendMarker, {backgroundColor: color}]} />
      <Text style={[styles.legendText, {color: textColor}]}>{label}</Text>
    </View>
  );
}

export function Legend({colors, note}: {colors: Palette; note: string}) {
  return (
    <View style={styles.legend}>
      <LegendItem label="교과 변경" color={colors.change} textColor={colors.secondary} />
      <LegendItem label="신설 수업" color={colors.added} textColor={colors.secondary} />
      <LegendItem label="행사" color={colors.event} textColor={colors.secondary} />
      <Text style={[styles.legendNote, {color: colors.secondary}]}>{note}</Text>
    </View>
  );
}

type WeekGridProps = {
  colors: Palette;
  width: number;
  clock: number;
  days: ApiDay[];
  periods: number[];
  renderCell: (dayIndex: number, periodIndex: number, cellWidth: number) => ReactNode;
};

/** 교시 × 요일 주간 표. 오늘 지난 교시는 흐리게, 지금 교시는 왼쪽 선으로 표시한다. */
export function WeekGrid({colors, width, clock, days, periods, renderCell}: WeekGridProps) {
  const periodWidth = Math.min(64, Math.max(48, width * 0.165));
  const cellWidth = Math.floor(Math.max(0, width - 2 - days.length - periodWidth) / Math.max(days.length, 1));
  const currentPeriodIndex = START_TIMES.findIndex((start, index) =>
    clock >= toMinutes(start) && clock <= toMinutes(END_TIMES[index]),
  );
  const remainingStart = firstRemainingPeriod(clock);
  const today = todayInKorea();
  return (
    <View style={[styles.grid, {width, backgroundColor: colors.border}]}>
      <View style={[styles.gridRow, styles.headerGridRow]}>
        <View style={[styles.cornerCell, {width: periodWidth, backgroundColor: colors.panelStrong}]}>
          <Text style={[styles.headerText, {color: colors.secondary}]}>교시</Text>
        </View>
        {days.map(day => {
          const isToday = day.iso === today;
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
      {periods.map((period, periodIndex) => (
        <View key={period + '-' + periodIndex} style={styles.gridRow}>
          <View style={[styles.periodCell, {width: periodWidth, backgroundColor: colors.panelStrong}]}>
            <Text style={[styles.periodNumber, {fontSize: Math.min(10, periodWidth * 0.18), color: colors.primary}]}>{period}교시</Text>
            <Text style={[styles.periodTime, {fontSize: Math.min(9, periodWidth * 0.16), color: colors.secondary}]}>{START_TIMES[periodIndex]}</Text>
            <Text style={[styles.periodTime, {fontSize: Math.min(9, periodWidth * 0.16), color: colors.secondary}]}>–{END_TIMES[periodIndex]}</Text>
          </View>
          {days.map((day, dayIndex) => {
            const isToday = day.iso === today;
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
                {renderCell(dayIndex, periodIndex, cellWidth)}
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

type NotificationModalProps = {
  colors: Palette;
  mode: '' | 'setup' | 'edit';
  hidden: boolean;
  draft: {changes: boolean; daily: boolean};
  permissionDenied: boolean;
  changeHint: string;
  dailyHint: string;
  targetLabel: string;
  targetValue: string;
  onChangeTarget: () => void;
  onToggle: (key: 'changes' | 'daily', value: boolean) => void;
  onFinish: () => void;
  onClose: () => void;
};

/** 처음 실행 때의 알림 설정(setup)과 상단 설정 버튼(edit)이 같이 쓰는 창. */
export function NotificationSettingsModal(props: NotificationModalProps) {
  const {colors, mode, draft, permissionDenied} = props;
  return (
    <Modal
      transparent
      animationType="fade"
      visible={mode !== '' && !props.hidden}
      onRequestClose={() => {
        if (mode === 'edit') props.onClose();
      }}>
      <View style={styles.modalBackdrop}>
        <View style={[styles.modalCard, {backgroundColor: colors.panel, borderColor: colors.border}]}>
          <Text style={[styles.modalTitle, {color: colors.primary}]}>{mode === 'setup' ? '알림 설정' : '설정'}</Text>
          {mode === 'setup' ? (
            <Text style={[styles.modalHint, {color: colors.secondary}]}>
              받을 알림을 고르세요. 나중에 상단 설정에서 바꿀 수 있습니다.
            </Text>
          ) : (
            <View style={[styles.settingRow, {borderBottomColor: colors.border}]}>
              <View style={styles.settingCopy}>
                <Text style={[styles.settingTitle, {color: colors.primary}]}>{props.targetLabel}</Text>
                <Text style={[styles.settingHint, {color: colors.secondary}]}>{props.targetValue || '선택 안 됨'}</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                onPress={props.onChangeTarget}
                style={[styles.retryButton, {borderColor: colors.border}]}>
                <Text style={[styles.cancelText, {color: colors.primary}]}>변경</Text>
              </Pressable>
            </View>
          )}
          <View style={[styles.settingRow, {borderBottomColor: colors.border}]}>
            <View style={styles.settingCopy}>
              <Text style={[styles.settingTitle, {color: colors.primary}]}>교과 변경 알림</Text>
              <Text style={[styles.settingHint, {color: colors.secondary}]}>{props.changeHint}</Text>
            </View>
            <Switch
              value={draft.changes}
              onValueChange={value => props.onToggle('changes', value)}
              trackColor={{true: colors.accent, false: colors.border}}
            />
          </View>
          <View style={[styles.settingRow, {borderBottomColor: colors.border}]}>
            <View style={styles.settingCopy}>
              <Text style={[styles.settingTitle, {color: colors.primary}]}>일일 수업 알림</Text>
              <Text style={[styles.settingHint, {color: colors.secondary}]}>{props.dailyHint}</Text>
            </View>
            <Switch
              value={draft.daily}
              onValueChange={value => props.onToggle('daily', value)}
              trackColor={{true: colors.accent, false: colors.border}}
            />
          </View>
          {permissionDenied ? (
            <View style={styles.permissionNote}>
              <Text style={styles.error}>알림 권한이 꺼져 있어 알림을 보낼 수 없습니다.</Text>
              <Pressable onPress={() => Linking.openSettings()} style={[styles.retryButton, {borderColor: colors.border}]}>
                <Text style={[styles.cancelText, {color: colors.primary}]}>알림 권한 켜기</Text>
              </Pressable>
            </View>
          ) : null}
          <View style={styles.modalActions}>
            {mode === 'setup' ? (
              <>
                {permissionDenied ? (
                  <Pressable onPress={props.onClose} style={styles.modalAction}>
                    <Text style={[styles.cancelText, {color: colors.secondary}]}>나중에</Text>
                  </Pressable>
                ) : null}
                <Pressable onPress={props.onFinish} style={[styles.primaryButton, {backgroundColor: colors.accent}]}>
                  <Text style={styles.primaryButtonText}>시작하기</Text>
                </Pressable>
              </>
            ) : (
              <Pressable onPress={props.onClose} style={styles.modalAction}>
                <Text style={[styles.cancelText, {color: colors.secondary}]}>닫기</Text>
              </Pressable>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

type Meal = {
  ok?: boolean;
  targetDate?: string;
  formattedDate?: string;
  mealCode?: string;
  mealTypeLabel?: string;
  menu?: string[];
  calories?: string;
};

const MEAL_CODES = [
  {code: '1', label: '아침'},
  {code: '2', label: '점심'},
  {code: '3', label: '저녁'},
];

// YYYYMMDD 날짜를 delta 방향으로 옮기되 주말은 건너뛴다.
function shiftSchoolDay(ymd: string, delta: number) {
  const date = new Date(Date.UTC(Number(ymd.slice(0, 4)), Number(ymd.slice(4, 6)) - 1, Number(ymd.slice(6, 8))));
  do {
    date.setUTCDate(date.getUTCDate() + delta);
  } while (date.getUTCDay() === 0 || date.getUTCDay() === 6);
  return date.toISOString().slice(0, 10).replace(/-/g, '');
}

/** 급식 탭. 날짜를 앞뒤로 넘기고 아침·점심·저녁을 고를 수 있다. 교사용·학생용이 같이 쓴다. */
export function MealView({colors, refreshKey}: {colors: Palette; refreshKey: number}) {
  // date, code가 비어 있으면 서버가 지금 시각에 맞는 급식을 고른다.
  // 그날 해당 끼니가 없으면 서버가 다른 끼니를 주므로, 날짜를 옮길 때는 사용자가 고른 끼니를 다시 요청한다.
  const [query, setQuery] = useState<{date?: string; code?: string}>({});
  const [meal, setMeal] = useState<Meal | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    (async () => {
      try {
        const response = await fetch(mealUrl(query.date, query.code));
        if (!response.ok) throw new Error('급식 요청 실패 (' + response.status + ')');
        const next = await response.json() as Meal;
        if (!cancelled) setMeal(next);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : '급식 정보를 불러오지 못했습니다.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [query, refreshKey]);

  const isToday = meal?.targetDate === todayInKorea().replace(/-/g, '');
  const shift = (delta: number) => setQuery({date: shiftSchoolDay(meal!.targetDate!, delta), code: query.code || meal?.mealCode});

  return (
    <>
      {meal?.targetDate ? (
        <View style={styles.mealDateRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="이전 날 급식"
            disabled={loading}
            onPress={() => shift(-1)}
            style={[styles.mealDateButton, {borderColor: colors.border, backgroundColor: colors.panel}]}>
            <Text style={[styles.mealDateButtonText, {color: colors.secondary}]}>◀</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="오늘 급식으로 돌아가기"
            disabled={loading || isToday}
            onPress={() => setQuery({})}
            style={styles.mealDateCenter}>
            <Text style={[styles.mealDateText, {color: colors.primary}]}>{meal.formattedDate}</Text>
            {isToday ? null : <Text style={[styles.mealTodayLink, {color: colors.accent}]}>오늘로</Text>}
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="다음 날 급식"
            disabled={loading}
            onPress={() => shift(1)}
            style={[styles.mealDateButton, {borderColor: colors.border, backgroundColor: colors.panel}]}>
            <Text style={[styles.mealDateButtonText, {color: colors.secondary}]}>▶</Text>
          </Pressable>
        </View>
      ) : null}
      <View style={styles.classChips}>
        {MEAL_CODES.map(item => {
          const active = meal?.mealCode === item.code;
          return (
            <Pressable
              key={item.code}
              accessibilityRole="button"
              onPress={() => setQuery({date: meal?.targetDate, code: item.code})}
              style={[
                styles.classChip,
                {borderColor: active ? colors.accent : colors.border, backgroundColor: active ? colors.accent + '22' : colors.panel},
              ]}>
              <Text style={[styles.classChipText, {color: active ? colors.primary : colors.secondary}]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {loading && !meal ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.accent} />
          <Text style={[styles.loadingText, {color: colors.secondary}]}>급식 불러오는 중</Text>
        </View>
      ) : meal ? (
        <View style={[styles.mealCard, {borderColor: colors.border, backgroundColor: colors.panel}, loading && styles.mealStale]}>
          <Text style={[styles.mealTitle, {color: colors.primary}]}>{isToday ? meal.mealTypeLabel : meal.mealTypeLabel?.replace('다음 ', '')}</Text>
          {meal.menu?.length ? meal.menu.map((item, index) => (
            <Text key={item + index} style={[styles.mealItem, {color: colors.primary, borderTopColor: colors.border}]}>{item}</Text>
          )) : (
            <Text style={[styles.todayEmpty, {color: colors.secondary}]}>급식 정보가 없습니다.</Text>
          )}
          {meal.calories ? <Text style={[styles.mealLabel, {color: colors.secondary}]}>{meal.calories}</Text> : null}
        </View>
      ) : null}
    </>
  );
}

const PLAY_INSTALLER = 'com.android.vending';

/** 앱을 켤 때 한 번 새 버전을 확인하고, 있으면 업데이트할지 묻는다. */
export function UpdatePrompt({colors, hidden}: {colors: Palette; hidden?: boolean}) {
  const [update, setUpdate] = useState<{app: AppInfo; release: AppRelease} | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const app = await WidgetSettings.getAppInfo();
        const response = await fetch(appVersionUrl());
        if (!response.ok) return;
        const releases = await response.json() as Record<string, AppRelease>;
        const release = releases[app.audience];
        if (!cancelled && release && release.versionCode > app.versionCode) setUpdate({app, release});
      } catch {
        // 확인에 실패하면 조용히 넘어간다. 다음 실행 때 다시 확인한다.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!update) return null;
  const {app, release} = update;
  const required = (release.minVersionCode || 0) > app.versionCode;
  const fromPlay = app.installer === PLAY_INSTALLER;

  const startUpdate = async () => {
    const playUrl = 'https://play.google.com/store/apps/details?id=' + app.packageName;
    try {
      if (fromPlay) await Linking.openURL('market://details?id=' + app.packageName);
      else await Linking.openURL(release.apkUrl || 'https://schedule.yjms.kr/download');
    } catch {
      await Linking.openURL(fromPlay ? playUrl : 'https://schedule.yjms.kr/download').catch(() => {});
    }
    if (!required) setUpdate(null);
  };

  return (
    <Modal
      transparent
      animationType="fade"
      visible={!hidden}
      onRequestClose={() => {
        if (!required) setUpdate(null);
      }}>
      <View style={styles.modalBackdrop}>
        <View style={[styles.modalCard, {backgroundColor: colors.panel, borderColor: colors.border}]}>
          <Text style={[styles.modalTitle, {color: colors.primary}]}>새 버전이 있습니다</Text>
          <Text style={[styles.modalHint, {color: colors.secondary}]}>
            {'현재 ' + app.versionName + ' → 최신 ' + release.versionName + '\n'}
            {required ? '이 버전은 더 이상 지원되지 않아 업데이트가 필요합니다.' : '지금 업데이트할까요?'}
          </Text>
          {release.notes?.length ? (
            <View style={styles.updateNotes}>
              {release.notes.map(note => (
                <Text key={note} style={[styles.updateNote, {color: colors.primary}]}>{'· ' + note}</Text>
              ))}
            </View>
          ) : null}
          {!fromPlay ? (
            <Text style={[styles.modalHint, {color: colors.secondary}]}>
              다운로드한 APK를 열어 설치하면 설정과 알림은 그대로 유지됩니다.
            </Text>
          ) : null}
          <View style={styles.modalActions}>
            {required ? null : (
              <Pressable onPress={() => setUpdate(null)} style={styles.modalAction}>
                <Text style={[styles.cancelText, {color: colors.secondary}]}>나중에</Text>
              </Pressable>
            )}
            <Pressable onPress={startUpdate} style={[styles.primaryButton, {backgroundColor: colors.accent}]}>
              <Text style={styles.primaryButtonText}>업데이트</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export const styles = StyleSheet.create({
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
  topActions: {flexDirection: 'row', gap: 8},
  settingRow: {minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 10},
  settingCopy: {flex: 1},
  settingTitle: {fontSize: 15, fontWeight: '700'},
  settingHint: {fontSize: 12, marginTop: 3},
  permissionNote: {marginTop: 12, alignItems: 'flex-start', gap: 8},
  primaryButton: {paddingHorizontal: 18, paddingVertical: 10, borderRadius: 8},
  primaryButtonText: {color: '#FFFFFF', fontSize: 13, fontWeight: '700'},
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
  academicUpcoming: {gap: 8, marginBottom: 14},
  academicUpcomingItem: {flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10},
  academicDday: {width: 52, fontSize: 15, fontWeight: '800'},
  academicUpcomingTitle: {flex: 1, fontSize: 14, fontWeight: '700'},
  academicUpcomingDate: {fontSize: 12},
  academicMonthBar: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10},
  academicMonthTitle: {fontSize: 16, fontWeight: '800'},
  academicGrid: {flexDirection: 'row', flexWrap: 'wrap', borderWidth: 1, borderRadius: 12, paddingVertical: 8, marginBottom: 8},
  academicWeekday: {width: '14.2857%', textAlign: 'center', fontSize: 11, fontWeight: '700', paddingBottom: 6},
  academicCell: {width: '14.2857%', height: 42, alignItems: 'center', justifyContent: 'flex-start', paddingTop: 2},
  academicDay: {width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center'},
  academicDayText: {fontSize: 13, fontWeight: '700'},
  academicDot: {width: 5, height: 5, borderRadius: 3, marginTop: 3},
  academicRow: {flexDirection: 'row', gap: 12, paddingVertical: 11, borderTopWidth: StyleSheet.hairlineWidth},
  academicRowDate: {width: 64, fontSize: 12, fontWeight: '700', paddingTop: 1},
  academicRowTitle: {fontSize: 14, fontWeight: '700'},
  modalCard: {width: '100%', borderWidth: 1, borderRadius: 16, padding: 18},
  modalTitle: {fontSize: 17, fontWeight: '800'},
  modalHint: {fontSize: 12, marginTop: 6, lineHeight: 17},
  updateNotes: {marginTop: 12, gap: 4},
  mealDateRow: {flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12},
  mealDateButton: {width: 44, height: 44, borderWidth: 1, borderRadius: 10, alignItems: 'center', justifyContent: 'center'},
  mealDateButtonText: {fontSize: 14, fontWeight: '700'},
  mealDateCenter: {flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 44},
  mealDateText: {fontSize: 16, fontWeight: '800'},
  mealTodayLink: {fontSize: 12, fontWeight: '700', marginTop: 2},
  mealStale: {opacity: 0.5},
  mealCard: {borderWidth: 1, borderRadius: 12, padding: 16},
  mealLabel: {fontSize: 12},
  mealTitle: {fontSize: 17, fontWeight: '800', marginTop: 4, marginBottom: 10},
  mealItem: {fontSize: 15, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth},
  updateNote: {fontSize: 13, lineHeight: 18},
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
