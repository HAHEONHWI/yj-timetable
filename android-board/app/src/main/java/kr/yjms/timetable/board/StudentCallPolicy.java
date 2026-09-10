package kr.yjms.timetable.board;

final class StudentCallPolicy {

    private StudentCallPolicy() {
    }

    static boolean shouldNotify(
        String configuredClass,
        String targetClass,
        String callId,
        String previousCallId,
        long expiresAtMs,
        long nowMs
    ) {
        return configuredClass != null
            && configuredClass.equals(targetClass)
            && callId != null
            && callId.length() > 0
            && !callId.equals(previousCallId)
            && expiresAtMs > nowMs;
    }
}
