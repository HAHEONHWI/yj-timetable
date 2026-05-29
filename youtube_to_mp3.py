from pathlib import Path
import sys

try:
    import yt_dlp
except ImportError:
    print("yt-dlp가 설치되어 있지 않습니다.")
    print("터미널에서 다음 명령을 실행해 주세요:")
    print("python3 -m pip install --user yt-dlp")
    sys.exit(1)


DESKTOP = Path.home() / "Desktop"
OUTPUT_DIR = DESKTOP / "YouTube MP3"


def download_mp3(url: str) -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    options = {
        "format": "bestaudio/best",
        "outtmpl": str(OUTPUT_DIR / "%(title).200B.%(ext)s"),
        "noplaylist": True,
        "ffmpeg_location": "/opt/homebrew/bin",
        "postprocessors": [
            {
                "key": "FFmpegExtractAudio",
                "preferredcodec": "mp3",
                "preferredquality": "192",
            }
        ],
    }

    with yt_dlp.YoutubeDL(options) as ydl:
        ydl.download([url])


def main() -> None:
    print("YouTube 링크를 MP3로 저장합니다.")
    print(f"저장 위치: {OUTPUT_DIR}")
    print("끝내려면 아무것도 입력하지 않고 Enter를 누르세요.")
    print()

    while True:
        url = input("YouTube 링크: ").strip()
        if not url:
            print("종료합니다.")
            return

        try:
            download_mp3(url)
            print(f"완료: {OUTPUT_DIR}")
        except Exception as exc:
            print(f"실패: {exc}")

        print()


if __name__ == "__main__":
    main()
