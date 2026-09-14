package kr.yjms.timetable.board;

public final class StudentCallPolicyTest {

    public static void main(String[] args) {
        assertTrue(StudentCallPolicy.shouldNotify("2-1", "2-1", "call-2", "call-1", 2_000L, 1_000L));
        assertFalse(StudentCallPolicy.shouldNotify("2-1", "3-1", "call-2", "call-1", 2_000L, 1_000L));
        assertFalse(StudentCallPolicy.shouldNotify("2-1", "2-1", "call-2", "call-2", 2_000L, 1_000L));
        assertFalse(StudentCallPolicy.shouldNotify("2-1", "2-1", "call-2", "call-1", 1_000L, 1_000L));
        System.out.println("student call policy tests passed");
    }

    private static void assertTrue(boolean value) {
        if (!value) throw new AssertionError("expected true");
    }

    private static void assertFalse(boolean value) {
        if (value) throw new AssertionError("expected false");
    }
}
