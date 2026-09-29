import React, {useEffect, useState} from 'react';
import {StyleSheet, View} from 'react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import StudentApp from './StudentApp';
import TeacherApp from './TeacherApp';
import {PALETTES, WidgetSettings} from './src/shared';

/** 빌드 종류(교사용/학생용)에 따라 화면을 고른다. 값은 네이티브 BuildConfig.AUDIENCE에서 온다. */
export default function App() {
  const [audience, setAudience] = useState<'teacher' | 'student' | null>(null);

  useEffect(() => {
    WidgetSettings.getSettings()
      .then(saved => setAudience(saved.audience === 'student' ? 'student' : 'teacher'))
      .catch(() => setAudience('teacher'));
  }, []);

  return (
    <SafeAreaProvider>
      {audience === null ? <View style={styles.splash} /> : audience === 'student' ? <StudentApp /> : <TeacherApp />}
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  splash: {flex: 1, backgroundColor: PALETTES.dark.background},
});
