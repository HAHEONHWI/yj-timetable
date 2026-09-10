package kr.yjms.timetable.board;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

final class NotificationDiff {

    private NotificationDiff() {
    }

    static boolean shouldCompare(boolean hasSnapshot, String previous, String current) {
        return hasSnapshot && !current.equals(previous);
    }

    static List<String> changedKeys(Map<String, String> previous, Map<String, String> current) {
        List<String> keys = new ArrayList<String>();
        for (Map.Entry<String, String> entry : current.entrySet()) {
            if (!entry.getValue().equals(previous.get(entry.getKey()))) {
                keys.add(entry.getKey());
            }
        }
        return keys;
    }

    static List<String> removedKeysOnOrAfter(
        Map<String, String> previous,
        Map<String, String> current,
        String today
    ) {
        List<String> keys = new ArrayList<String>();
        for (String key : previous.keySet()) {
            int separator = key.indexOf("__");
            String date = separator < 0 ? "" : key.substring(0, separator);
            if (date.compareTo(today) >= 0 && !current.containsKey(key)) {
                keys.add(key);
            }
        }
        return keys;
    }
}
