package kr.yjms.timetable.board;

public final class StudentCallPolicyTest {

    public static void main(String[] args) {
        assertTrue(StudentCallPolicy.shouldNotify("2-1", "2-1", "call-2", "call-1", 2_000L, 1_000L));
        assertFalse(StudentCallPolicy.shouldNotify("2-1", "3-1", "call-2", "call-1", 2_000L, 1_000L));
        assertFalse(StudentCallPolicy.shouldNotify("2-1", "2-1", "call-1", "call-1", 2_000L, 1_000L));
        assertFalse(StudentCallPolicy.shouldNotify("2-1", "2-1", "call-2", "call-1", 1_000L, 1_000L));
        assertTrue(StudentCallPolicy.shouldUseFullScreen(false));
        assertFalse(StudentCallPolicy.shouldUseFullScreen(true));
        System.out.println("StudentCallPolicyTest: 6 passed");
    }

    private static void assertTrue(boolean value) {
        if (!value) throw new AssertionError("Expected true");
    }

    private static void assertFalse(boolean value) {
        if (value) throw new AssertionError("Expected false");
    }
}
