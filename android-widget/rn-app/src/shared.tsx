import React, {ReactNode} from 'react';
import {
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
