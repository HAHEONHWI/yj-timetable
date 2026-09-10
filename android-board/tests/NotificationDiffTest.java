package kr.yjms.timetable.board;

import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;

public final class NotificationDiffTest {

    public static void main(String[] args) {
        firstChangeAfterEmptyBaselineIsDetected();
        firstPollDoesNotNotify();
        expiredChangeIsNotReportedAsCancelled();
        noticeAddAndEditAreDetectedButDeletionIsIgnored();
        System.out.println("NotificationDiffTest: 4 passed");
    }

    private static void firstChangeAfterEmptyBaselineIsDetected() {
        assertTrue(NotificationDiff.shouldCompare(true, "", "2026-09-10__1-1__1=수학||swap"));
    }

    private static void firstPollDoesNotNotify() {
        assertFalse(NotificationDiff.shouldCompare(false, "", "2026-09-10__1-1__1=수학||swap"));
    }

    private static void expiredChangeIsNotReportedAsCancelled() {
        Map<String, String> previous = mapOf("2026-09-08__1-1__1", "수학||swap");
        List<String> removed = NotificationDiff.removedKeysOnOrAfter(previous, Collections.<String, String>emptyMap(), "2026-09-09");
        assertEquals(Collections.<String>emptyList(), removed);
    }

    private static void noticeAddAndEditAreDetectedButDeletionIsIgnored() {
        Map<String, String> previous = mapOf("notice-1", "기존\u001f내용");
        Map<String, String> current = new TreeMap<String, String>();
        current.put("notice-1", "수정\u001f내용");
        current.put("notice-2", "신규\u001f공지");
        assertEquals(Arrays.asList("notice-1", "notice-2"), NotificationDiff.changedKeys(previous, current));
        assertEquals(
            Collections.<String>emptyList(),
            NotificationDiff.changedKeys(previous, Collections.<String, String>emptyMap())
        );
    }

    private static Map<String, String> mapOf(String key, String value) {
        Map<String, String> map = new TreeMap<String, String>();
        map.put(key, value);
        return map;
    }

    private static void assertTrue(boolean value) {
        if (!value) throw new AssertionError("expected true");
    }

    private static void assertFalse(boolean value) {
        if (value) throw new AssertionError("expected false");
    }

    private static void assertEquals(Object expected, Object actual) {
        if (!expected.equals(actual)) {
            throw new AssertionError("expected " + expected + " but got " + actual);
        }
    }
}
