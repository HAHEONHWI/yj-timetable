// netlify/functions/meal.js
const https = require("https");

const ATPT_OFCDC_SC_CODE = "Q10"; // 전남광주통합특별시교육청(전남)
const SD_SCHUL_CODE = "8602013";   // 용정중학교

const WEEKDAY_NAMES = ["일", "월", "화", "수", "목", "금", "토"];

function pad(n) {
  return String(n).padStart(2, "0");
}

function getKstDate() {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  return new Date(utc + 9 * 60 * 60000);
}

function toYmd(d) {
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
}

/**
 * 시간대별로 표시할 급식 날짜 및 끼니 코드(1: 조식, 2: 중식, 3: 석식)를 결정
 *
 * 00:00 ~ 07:45: 🌅 아침 (조식, 전날 저녁부터 이어지는 구간)
 * 07:45 ~ 12:20: ☀️ 점심 (중식)
 * 12:20 ~ 18:10: 🌙 저녁 (석식)
 * 18:10 이후:    🌅 다음날 아침 (조식)
 */
function resolveMealTarget(queryDate, queryMealCode) {
  const kst = getKstDate();
  const todayYmd = toYmd(kst);

  if (queryDate && /^\d{8}$/.test(queryDate)) {
    return {
      targetDate: queryDate,
      mealCode: queryMealCode || "2",
      isCustomDate: true,
      timeSlot: "custom",
    };
  }

  const hour = kst.getHours();
  const min = kst.getMinutes();
  const totalMinutes = hour * 60 + min;
  const day = kst.getDay(); // 0: 일, 1: 월, ... 5: 금, 6: 토

  // 주말 처리 (토요일, 일요일 -> 다음주 월요일 아침)
  if (day === 6) {
    // 토요일
    const monday = new Date(kst);
    monday.setDate(kst.getDate() + 2);
    return {
      targetDate: toYmd(monday),
      mealCode: "1",
      timeSlot: "weekend",
      defaultLabel: "🌅 월요일 아침 (조식)",
      weekdayName: "월",
      isToday: false,
    };
  }
  if (day === 0) {
    // 일요일
    const monday = new Date(kst);
    monday.setDate(kst.getDate() + 1);
    return {
      targetDate: toYmd(monday),
      mealCode: "1",
      timeSlot: "weekend",
      defaultLabel: "🌅 월요일 아침 (조식)",
      weekdayName: "월",
      isToday: false,
    };
  }

  // 평일 시간대별 분기
  if (totalMinutes < 7 * 60 + 45) {
    // 00:00 ~ 07:45 -> 오늘 아침 (조식)
    return {
      targetDate: todayYmd,
      mealCode: "1",
      timeSlot: "breakfast",
      defaultLabel: "🌅 오늘 아침 (조식)",
      weekdayName: WEEKDAY_NAMES[day],
      isToday: true,
    };
  }

  if (totalMinutes < 12 * 60 + 20) {
    // 07:45 ~ 12:20 -> 오늘 점심 (중식)
    return {
      targetDate: todayYmd,
      mealCode: "2",
      timeSlot: "lunch",
      defaultLabel: "☀️ 오늘 점심 (중식)",
      weekdayName: WEEKDAY_NAMES[day],
      isToday: true,
    };
  }

  if (totalMinutes < 18 * 60 + 10) {
    // 12:20 ~ 18:10 -> 오늘 저녁 (석식)
    return {
      targetDate: todayYmd,
      mealCode: "3",
      timeSlot: "dinner",
      defaultLabel: "🌙 오늘 저녁 (석식)",
      weekdayName: WEEKDAY_NAMES[day],
      isToday: true,
    };
  }

  // 18:10 이후 -> 다음 학교일 아침 (조식)
  if (day === 5) {
    // 금요일 밤 -> 다음주 월요일 아침
    const monday = new Date(kst);
    monday.setDate(kst.getDate() + 3);
    return {
      targetDate: toYmd(monday),
      mealCode: "1",
      timeSlot: "next_morning",
      defaultLabel: "🌅 월요일 아침 (조식)",
      weekdayName: "월",
      isToday: false,
    };
  }

  // 월~목 밤 -> 내일 아침
  const tomorrow = new Date(kst);
  tomorrow.setDate(kst.getDate() + 1);
  const tomorrowDay = tomorrow.getDay();
  return {
    targetDate: toYmd(tomorrow),
    mealCode: "1",
    timeSlot: "next_morning",
    defaultLabel: "🌅 내일 아침 (조식)",
    weekdayName: WEEKDAY_NAMES[tomorrowDay],
    isToday: false,
  };
}

function fetchNeisMeal(dateStr, apiKey) {
  return new Promise((resolve) => {
    let url = `https://open.neis.go.kr/hub/mealServiceDietInfo?Type=json&ATPT_OFCDC_SC_CODE=${ATPT_OFCDC_SC_CODE}&SD_SCHUL_CODE=${SD_SCHUL_CODE}&MLSV_YMD=${dateStr}`;
    if (apiKey) {
      url += `&KEY=${encodeURIComponent(apiKey)}`;
    }

    https
      .get(url, (res) => {
        let data = "";
        res.on("data", (chunk) => {
          data += chunk;
        });
        res.on("end", () => {
          try {
            const json = JSON.parse(data);
            resolve(json);
          } catch (e) {
            resolve(null);
          }
        });
      })
      .on("error", () => {
        resolve(null);
      });
  });
}

function cleanDishName(dish) {
  return dish
    // 알레르기 번호 제거 (예: 1.2.5.13. 또는 (1.2.5))
    .replace(/\([0-9.]+\)/g, "")
    .replace(/[0-9.]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function getMealNameByCode(code) {
  switch (String(code)) {
    case "1":
      return "조식";
    case "2":
      return "중식";
    case "3":
      return "석식";
    default:
      return "급식";
  }
}

function getMealEmoji(code) {
  switch (String(code)) {
    case "1":
      return "🌅";
    case "2":
      return "☀️";
    case "3":
      return "🌙";
    default:
      return "🍱";
  }
}

exports.handler = async (event) => {
  const query = event.queryStringParameters || {};
  const target = resolveMealTarget(query.date, query.mealCode);
  const apiKey = process.env.NEIS_API_KEY || "";

  const rawData = await fetchNeisMeal(target.targetDate, apiKey);

  const year = target.targetDate.slice(0, 4);
  const month = target.targetDate.slice(4, 6);
  const day = target.targetDate.slice(6, 8);

  const kst = getKstDate();
  const todayYmd = toYmd(kst);
  const isToday = target.targetDate === todayYmd;

  // 요일 계산
  const targetDateObj = new Date(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10));
  const weekdayName = WEEKDAY_NAMES[targetDateObj.getDay()];
  const formattedDate = `${parseInt(month, 10)}월 ${parseInt(day, 10)}일 (${weekdayName})`;

  let selectedRow = null;
  let menuList = [];
  let calories = "";
  let actualMealCode = target.mealCode;
  let actualMealName = getMealNameByCode(target.mealCode);

  if (
    rawData &&
    rawData.mealServiceDietInfo &&
    rawData.mealServiceDietInfo[1] &&
    rawData.mealServiceDietInfo[1].row &&
    rawData.mealServiceDietInfo[1].row.length > 0
  ) {
    const rows = rawData.mealServiceDietInfo[1].row;
    // 1순위: 타겟 끼니 코드(조식/중식/석식)
    selectedRow = rows.find((r) => r.MMEAL_SC_CODE === String(target.mealCode));

    // 만약 해당 끼니가 없으면(예: 석식 미운영 등) 첫 번째 등록된 끼니로 fallback
    if (!selectedRow && rows.length > 0) {
      selectedRow = rows[0];
      actualMealCode = selectedRow.MMEAL_SC_CODE;
      actualMealName = selectedRow.MMEAL_SC_NM || getMealNameByCode(actualMealCode);
    }

    if (selectedRow && selectedRow.DDISH_NM) {
      calories = selectedRow.CAL_INFO || "";
      const rawDishes = selectedRow.DDISH_NM.split("<br/>");
      menuList = rawDishes
        .map(cleanDishName)
        .filter((name) => name.length > 0);
    }
  }

  // 상단 헤더 라벨 조합 (예: "☀️ 오늘 점심 (중식)" / "🌅 내일 아침 (조식)")
  const emoji = getMealEmoji(actualMealCode);
  const dayPrefix = isToday ? "오늘" : "다음";
  let mealTypeLabel = "";

  if (actualMealCode === "1") {
    mealTypeLabel = isToday ? "🌅 오늘 아침 (조식)" : "🌅 다음 아침 (조식)";
  } else if (actualMealCode === "2") {
    mealTypeLabel = isToday ? "☀️ 오늘 점심 (중식)" : "☀️ 다음 점심 (중식)";
  } else if (actualMealCode === "3") {
    mealTypeLabel = isToday ? "🌙 오늘 저녁 (석식)" : "🌙 다음 저녁 (석식)";
  } else {
    mealTypeLabel = `${emoji} ${dayPrefix} ${actualMealName}`;
  }

  const result = {
    ok: true,
    targetDate: target.targetDate,
    formattedDate,
    mealCode: actualMealCode,
    mealName: actualMealName,
    mealTypeLabel,
    isToday,
    menu: menuList,
    calories,
  };

  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=600", // 10분 캐시
    },
    body: JSON.stringify(result),
  };
};
