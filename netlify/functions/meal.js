// netlify/functions/meal.js
const https = require("https");

const ATPT_OFCDC_SC_CODE = "Q10"; // 전남광주통합특별시교육청(전남)
const SD_SCHUL_CODE = "8602013";   // 용정중학교

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

function getTargetMealDate(queryDate) {
  if (queryDate && /^\d{8}$/.test(queryDate)) {
    return queryDate;
  }

  const kst = getKstDate();
  const hour = kst.getHours();
  const day = kst.getDay(); // 0: 일, 1: 월, ... 5: 금, 6: 토

  // 14시(오후 2시) 이후이거나 주말이면 다음 급식일로 스케줄링
  if (hour >= 14 || day === 0 || day === 6) {
    if (day === 5) {
      // 금요일 14시 이후 -> 다음주 월요일 (+3일)
      kst.setDate(kst.getDate() + 3);
    } else if (day === 6) {
      // 토요일 -> 다음주 월요일 (+2일)
      kst.setDate(kst.getDate() + 2);
    } else if (day === 0) {
      // 일요일 -> 월요일 (+1일)
      kst.setDate(kst.getDate() + 1);
    } else {
      // 평일 14시 이후 -> 내일 (+1일)
      kst.setDate(kst.getDate() + 1);
    }
  }

  return toYmd(kst);
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

exports.handler = async (event) => {
  const query = event.queryStringParameters || {};
  const targetDate = getTargetMealDate(query.date);
  const apiKey = process.env.NEIS_API_KEY || "";

  const rawData = await fetchNeisMeal(targetDate, apiKey);

  const year = targetDate.slice(0, 4);
  const month = targetDate.slice(4, 6);
  const day = targetDate.slice(6, 8);
  const formattedDate = `${parseInt(month, 10)}월 ${parseInt(day, 10)}일`;

  const kst = getKstDate();
  const todayYmd = toYmd(kst);
  const isToday = targetDate === todayYmd;
  const isTomorrow = !isToday;

  let menuList = [];
  let calories = "";

  if (
    rawData &&
    rawData.mealServiceDietInfo &&
    rawData.mealServiceDietInfo[1] &&
    rawData.mealServiceDietInfo[1].row &&
    rawData.mealServiceDietInfo[1].row.length > 0
  ) {
    // 중식(2) 우선 검색, 없으면 첫 번째 식단
    const rows = rawData.mealServiceDietInfo[1].row;
    const lunchRow = rows.find((r) => r.MMEAL_SC_CODE === "2") || rows[0];

    if (lunchRow && lunchRow.DDISH_NM) {
      calories = lunchRow.CAL_INFO || "";
      const rawDishes = lunchRow.DDISH_NM.split("<br/>");
      menuList = rawDishes
        .map(cleanDishName)
        .filter((name) => name.length > 0);
    }
  }

  const result = {
    ok: true,
    targetDate,
    formattedDate,
    isToday,
    isTomorrow,
    label: isToday ? "오늘의 급식" : "다음 급식",
    menu: menuList,
    calories,
  };

  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=1800", // 30분 캐시
    },
    body: JSON.stringify(result),
  };
};
