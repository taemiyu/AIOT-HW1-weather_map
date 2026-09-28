// UI strings, county names and weather-phrase translations for zh-TW / en / ja / ko.
// Station names are proper nouns from CWA and stay as published.

const LANGS = {
  "zh-TW": "繁體中文",
  en: "English",
  ja: "日本語",
  ko: "한국어",
};

const STRINGS = {
  "zh-TW": {
    title: "台灣即時天氣 GIS",
    subtitle: "中央氣象署開放資料",
    layers: "圖層",
    overlays: "顯示",
    basemap: "底圖",
    language: "語言",
    layer_temp: "氣溫", layer_rain: "雨量", layer_radar: "雷達", layer_typhoon: "颱風",
    layer_wind: "風速風向", layer_humidity: "濕度", layer_weather: "天氣",
    ov_stations: "測站點位", ov_counties: "縣市界線", ov_labels: "氣溫數字標籤",
    base_street: "街道圖", base_light: "淺色", base_dark: "深色",
    locate: "定位我的位置", locating: "定位中…", locate_fail: "無法取得位置：",
    nearest: "最近測站",
    you_are_here: "你的位置",
    obs_time: "觀測時間", updated: "資料更新", stations: "測站", station_count: "測站數",
    highest: "最高", lowest: "最低", average: "平均", max: "最大",
    temp: "氣溫", min_t: "今日最低", max_t: "今日最高", humidity: "相對濕度",
    wind: "風", wind_speed: "風速", wind_dir: "風向", pressure: "氣壓", precip: "今日雨量",
    uv: "紫外線指數", altitude: "海拔", weather: "天氣",
    rain_now: "本日累積", rain_10min: "10 分鐘", rain_1hr: "1 小時", rain_3hr: "3 小時", rain_24hr: "24 小時",
    rain_period: "累積時段", raining_stations: "有降雨測站",
    beaufort: "級", bft_max: "最大風級", no_data: "無資料",
    county: "縣市", all_counties: "全台灣", search: "搜尋測站…", no_match: "找不到測站",
    ranking_hot: "最熱測站", ranking_cold: "最冷測站", ranking_wet: "雨量最多", ranking_windy: "風最強",
    ranking_humid: "最潮濕",
    typhoon: "颱風", no_typhoon: "目前沒有活動中的颱風",
    ty_position: "中心位置", ty_max_wind: "近中心最大風速", ty_gust: "瞬間最大陣風",
    ty_pressure: "中心氣壓", ty_moving: "移動", ty_r15: "七級風暴風半徑", ty_r25: "十級風暴風半徑",
    ty_r70: "70% 機率半徑", ty_past: "過去路徑", ty_forecast: "預測路徑", ty_hours: "小時後",
    radar_time: "雷達時間", radar_play: "播放", radar_pause: "暫停", radar_frames: "張",
    refresh: "從氣象署更新資料", refreshing: "更新中…（約 1 分鐘）", refresh_done: "資料已更新",
    refresh_fail: "更新失敗", source: "資料來源", menu: "選單", close: "關閉",
    legend_temp: "氣溫 (°C)", legend_rain: "雨量 (mm)", legend_humidity: "相對濕度 (%)",
    legend_wind: "風速（蒲福風級）", legend_radar: "回波強度 (dBZ)",
    km: "公里", kmh: "公里/時", ms: "公尺/秒",
    county_avg: "縣市平均",
  },
  en: {
    title: "Taiwan Live Weather GIS",
    subtitle: "Central Weather Administration Open Data",
    layers: "Layers",
    overlays: "Show",
    basemap: "Basemap",
    language: "Language",
    layer_temp: "Temperature", layer_rain: "Rainfall", layer_radar: "Radar", layer_typhoon: "Typhoon",
    layer_wind: "Wind", layer_humidity: "Humidity", layer_weather: "Weather",
    ov_stations: "Station points", ov_counties: "County borders", ov_labels: "Temperature labels",
    base_street: "Streets", base_light: "Light", base_dark: "Dark",
    locate: "Find my location", locating: "Locating…", locate_fail: "Could not get location: ",
    nearest: "Nearest station",
    you_are_here: "You are here",
    obs_time: "Observed", updated: "Data updated", stations: "stations", station_count: "Stations",
    highest: "Highest", lowest: "Lowest", average: "Average", max: "Max",
    temp: "Temperature", min_t: "Today's low", max_t: "Today's high", humidity: "Humidity",
    wind: "Wind", wind_speed: "Wind speed", wind_dir: "Direction", pressure: "Pressure", precip: "Rain today",
    uv: "UV index", altitude: "Altitude", weather: "Weather",
    rain_now: "Today", rain_10min: "10 min", rain_1hr: "1 hr", rain_3hr: "3 hr", rain_24hr: "24 hr",
    rain_period: "Period", raining_stations: "Stations with rain",
    beaufort: "Bft", bft_max: "Max Beaufort", no_data: "No data",
    county: "County", all_counties: "All Taiwan", search: "Search stations…", no_match: "No station found",
    ranking_hot: "Hottest", ranking_cold: "Coldest", ranking_wet: "Wettest", ranking_windy: "Windiest",
    ranking_humid: "Most humid",
    typhoon: "Typhoon", no_typhoon: "No active tropical cyclones",
    ty_position: "Center", ty_max_wind: "Max sustained wind", ty_gust: "Max gust",
    ty_pressure: "Central pressure", ty_moving: "Movement", ty_r15: "Gale radius (Bft 7)",
    ty_r25: "Storm radius (Bft 10)", ty_r70: "70% probability radius", ty_past: "Past track",
    ty_forecast: "Forecast track", ty_hours: "h ahead",
    radar_time: "Radar time", radar_play: "Play", radar_pause: "Pause", radar_frames: "frames",
    refresh: "Update from CWA", refreshing: "Updating… (~1 min)", refresh_done: "Data updated",
    refresh_fail: "Update failed", source: "Source", menu: "Menu", close: "Close",
    legend_temp: "Temperature (°C)", legend_rain: "Rainfall (mm)", legend_humidity: "Humidity (%)",
    legend_wind: "Wind (Beaufort)", legend_radar: "Reflectivity (dBZ)",
    km: "km", kmh: "km/h", ms: "m/s",
    county_avg: "County average",
  },
  ja: {
    title: "台湾リアルタイム気象 GIS",
    subtitle: "中央気象署オープンデータ",
    layers: "レイヤー",
    overlays: "表示",
    basemap: "ベースマップ",
    language: "言語",
    layer_temp: "気温", layer_rain: "雨量", layer_radar: "レーダー", layer_typhoon: "台風",
    layer_wind: "風向・風速", layer_humidity: "湿度", layer_weather: "天気",
    ov_stations: "観測地点", ov_counties: "県市境界", ov_labels: "気温ラベル",
    base_street: "道路地図", base_light: "ライト", base_dark: "ダーク",
    locate: "現在地を表示", locating: "測位中…", locate_fail: "位置を取得できません：",
    nearest: "最寄りの観測地点",
    you_are_here: "現在地",
    obs_time: "観測時刻", updated: "データ更新", stations: "地点", station_count: "観測地点数",
    highest: "最高", lowest: "最低", average: "平均", max: "最大",
    temp: "気温", min_t: "今日の最低", max_t: "今日の最高", humidity: "湿度",
    wind: "風", wind_speed: "風速", wind_dir: "風向", pressure: "気圧", precip: "今日の雨量",
    uv: "UV指数", altitude: "標高", weather: "天気",
    rain_now: "本日積算", rain_10min: "10分", rain_1hr: "1時間", rain_3hr: "3時間", rain_24hr: "24時間",
    rain_period: "積算時間", raining_stations: "降雨のある地点",
    beaufort: "級", bft_max: "最大風力階級", no_data: "データなし",
    county: "県市", all_counties: "台湾全域", search: "観測地点を検索…", no_match: "見つかりません",
    ranking_hot: "最も暑い地点", ranking_cold: "最も寒い地点", ranking_wet: "雨量が多い地点",
    ranking_windy: "風が強い地点", ranking_humid: "湿度が高い地点",
    typhoon: "台風", no_typhoon: "現在、活動中の台風はありません",
    ty_position: "中心位置", ty_max_wind: "最大風速", ty_gust: "最大瞬間風速",
    ty_pressure: "中心気圧", ty_moving: "進行", ty_r15: "強風域半径（7級）", ty_r25: "暴風域半径（10級）",
    ty_r70: "70%確率円", ty_past: "経路", ty_forecast: "予報経路", ty_hours: "時間後",
    radar_time: "レーダー時刻", radar_play: "再生", radar_pause: "停止", radar_frames: "枚",
    refresh: "気象署から更新", refreshing: "更新中…（約1分）", refresh_done: "更新しました",
    refresh_fail: "更新に失敗しました", source: "出典", menu: "メニュー", close: "閉じる",
    legend_temp: "気温 (°C)", legend_rain: "雨量 (mm)", legend_humidity: "湿度 (%)",
    legend_wind: "風速（ビューフォート）", legend_radar: "反射強度 (dBZ)",
    km: "km", kmh: "km/h", ms: "m/s",
    county_avg: "県市平均",
  },
  ko: {
    title: "대만 실시간 날씨 GIS",
    subtitle: "중앙기상서 공공데이터",
    layers: "레이어",
    overlays: "표시",
    basemap: "배경 지도",
    language: "언어",
    layer_temp: "기온", layer_rain: "강수량", layer_radar: "레이더", layer_typhoon: "태풍",
    layer_wind: "풍향·풍속", layer_humidity: "습도", layer_weather: "날씨",
    ov_stations: "관측소", ov_counties: "행정구역 경계", ov_labels: "기온 숫자",
    base_street: "일반 지도", base_light: "밝게", base_dark: "어둡게",
    locate: "내 위치 찾기", locating: "위치 확인 중…", locate_fail: "위치를 가져올 수 없습니다: ",
    nearest: "가장 가까운 관측소",
    you_are_here: "현재 위치",
    obs_time: "관측 시각", updated: "데이터 갱신", stations: "개 관측소", station_count: "관측소 수",
    highest: "최고", lowest: "최저", average: "평균", max: "최대",
    temp: "기온", min_t: "오늘 최저", max_t: "오늘 최고", humidity: "습도",
    wind: "바람", wind_speed: "풍속", wind_dir: "풍향", pressure: "기압", precip: "오늘 강수량",
    uv: "자외선 지수", altitude: "해발", weather: "날씨",
    rain_now: "오늘 누적", rain_10min: "10분", rain_1hr: "1시간", rain_3hr: "3시간", rain_24hr: "24시간",
    rain_period: "누적 기간", raining_stations: "비가 온 관측소",
    beaufort: "등급", bft_max: "최대 풍력 등급", no_data: "데이터 없음",
    county: "행정구역", all_counties: "대만 전체", search: "관측소 검색…", no_match: "관측소 없음",
    ranking_hot: "가장 더운 곳", ranking_cold: "가장 추운 곳", ranking_wet: "강수량 많은 곳",
    ranking_windy: "바람이 강한 곳", ranking_humid: "가장 습한 곳",
    typhoon: "태풍", no_typhoon: "현재 활동 중인 태풍이 없습니다",
    ty_position: "중심 위치", ty_max_wind: "최대 풍속", ty_gust: "최대 순간풍속",
    ty_pressure: "중심 기압", ty_moving: "이동", ty_r15: "강풍 반경(7등급)", ty_r25: "폭풍 반경(10등급)",
    ty_r70: "70% 확률 반경", ty_past: "지나온 경로", ty_forecast: "예상 경로", ty_hours: "시간 후",
    radar_time: "레이더 시각", radar_play: "재생", radar_pause: "정지", radar_frames: "장",
    refresh: "기상서에서 갱신", refreshing: "갱신 중… (약 1분)", refresh_done: "갱신 완료",
    refresh_fail: "갱신 실패", source: "출처", menu: "메뉴", close: "닫기",
    legend_temp: "기온 (°C)", legend_rain: "강수량 (mm)", legend_humidity: "습도 (%)",
    legend_wind: "풍속 (보퍼트)", legend_radar: "반사도 (dBZ)",
    km: "km", kmh: "km/h", ms: "m/s",
    county_avg: "행정구역 평균",
  },
};

// County names keyed by the CWA spelling stored in the database.
const COUNTIES = {
  "基隆市": { en: "Keelung City", ko: "지룽시" },
  "臺北市": { en: "Taipei City", ko: "타이베이시" },
  "新北市": { en: "New Taipei City", ko: "신베이시" },
  "桃園市": { en: "Taoyuan City", ko: "타오위안시" },
  "新竹市": { en: "Hsinchu City", ko: "신주시" },
  "新竹縣": { en: "Hsinchu County", ko: "신주현" },
  "苗栗縣": { en: "Miaoli County", ko: "먀오리현" },
  "臺中市": { en: "Taichung City", ko: "타이중시" },
  "彰化縣": { en: "Changhua County", ko: "장화현" },
  "南投縣": { en: "Nantou County", ko: "난터우현" },
  "雲林縣": { en: "Yunlin County", ko: "윈린현" },
  "嘉義市": { en: "Chiayi City", ko: "자이시" },
  "嘉義縣": { en: "Chiayi County", ko: "자이현" },
  "臺南市": { en: "Tainan City", ko: "타이난시" },
  "高雄市": { en: "Kaohsiung City", ko: "가오슝시" },
  "屏東縣": { en: "Pingtung County", ko: "핑둥현" },
  "宜蘭縣": { en: "Yilan County", ko: "이란현" },
  "花蓮縣": { en: "Hualien County", ko: "화롄현" },
  "臺東縣": { en: "Taitung County", ko: "타이둥현" },
  "澎湖縣": { en: "Penghu County", ko: "펑후현" },
  "金門縣": { en: "Kinmen County", ko: "진먼현" },
  "連江縣": { en: "Lienchiang County", ko: "롄장현" },
};

function countyName(name, lang) {
  if (!name) return "";
  if (lang === "zh-TW") return name;
  if (lang === "ja") return name.replace(/臺/g, "台").replace(/縣/g, "県");
  return (COUNTIES[name] && COUNTIES[name][lang]) || name;
}

// CWA weather phrases: matched longest-first, translated piece by piece.
const WEATHER_TERMS = [
  ["晴", { en: "Clear", ja: "晴れ", ko: "맑음" }],
  ["多雲", { en: "Cloudy", ja: "くもり", ko: "구름 많음" }],
  ["陰", { en: "Overcast", ja: "曇天", ko: "흐림" }],
  ["有雷聲", { en: "thunder", ja: "雷鳴", ko: "천둥" }],
  ["有雷雨", { en: "thunderstorm", ja: "雷雨", ko: "뇌우" }],
  ["有大雷雨", { en: "heavy thunderstorm", ja: "激しい雷雨", ko: "강한 뇌우" }],
  ["有陣雨", { en: "showers", ja: "にわか雨", ko: "소나기" }],
  ["有毛毛雨", { en: "drizzle", ja: "霧雨", ko: "이슬비" }],
  ["有大雨", { en: "heavy rain", ja: "大雨", ko: "큰비" }],
  ["有雨", { en: "rain", ja: "雨", ko: "비" }],
  ["有靄", { en: "mist", ja: "もや", ko: "박무" }],
  ["有霾", { en: "haze", ja: "煙霧", ko: "연무" }],
  ["有霧", { en: "fog", ja: "霧", ko: "안개" }],
  ["有雪", { en: "snow", ja: "雪", ko: "눈" }],
  ["有冰雹", { en: "hail", ja: "ひょう", ko: "우박" }],
];
const WEATHER_SORTED = [...WEATHER_TERMS].sort((a, b) => b[0].length - a[0].length);

function weatherText(text, lang) {
  if (!text) return null;
  if (lang === "zh-TW") return text;
  let rest = text;
  const parts = [];
  while (rest.length) {
    const hit = WEATHER_SORTED.find(([zh]) => rest.startsWith(zh));
    if (!hit) return text; // unknown phrase: show CWA original rather than guess
    parts.push(hit[1][lang]);
    rest = rest.slice(hit[0].length);
  }
  return parts.join(lang === "en" ? ", " : "・");
}

const COMPASS = {
  "zh-TW": ["北", "北北東", "東北", "東北東", "東", "東南東", "東南", "南南東", "南", "南南西", "西南", "西南西", "西", "西北西", "西北", "北北西"],
  en: ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"],
  ja: ["北", "北北東", "北東", "東北東", "東", "東南東", "南東", "南南東", "南", "南南西", "南西", "西南西", "西", "西北西", "北西", "北北西"],
  ko: ["북", "북북동", "북동", "동북동", "동", "동남동", "남동", "남남동", "남", "남남서", "남서", "서남서", "서", "서북서", "북서", "북북서"],
};
const COMPASS_ABBR = { N: 0, NNE: 1, NE: 2, ENE: 3, E: 4, ESE: 5, SE: 6, SSE: 7, S: 8, SSW: 9, SW: 10, WSW: 11, W: 12, WNW: 13, NW: 14, NNW: 15 };

function compass(deg, lang) {
  if (deg == null) return null;
  return COMPASS[lang][Math.round(deg / 22.5) % 16];
}

function compassAbbr(abbr, lang) {
  const i = COMPASS_ABBR[abbr];
  return i == null ? abbr : COMPASS[lang][i];
}
