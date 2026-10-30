/**
 * [기존 버전(v1) & 실시간 좌석 연동 버전(v2.1) 모두 호환되는 Google Apps Script]
 *
 * 구글 시트 > 확장 프로그램 > Apps Script 에 붙여넣고
 * [배포] -> [배포 관리] -> 연필 아이콘(수정) -> 버전: "새 버전" -> [배포] 를 눌러주세요!
 *
 * - 시트 이름: "예약" (A열: 날짜, B열: 강좌, C열: 이름, D열: 연락처, E열: 인원, F열: 결제 금액, G열: 신청 시각)
 * - doGet: 강좌별 총 예약 인원을 합산하여 반환 (v2.1 실시간 좌석 연동용)
 * - doPost: 새 행 추가 + v2.1에서 maxSeats를 보낸 경우 정원 초과 동시성 차단 (v1에서 요청 시에도 완벽 호환)
 */

function getCourseBookedMap_(sheet) {
  var bookedByCourse = {};
  var lastRow = sheet.getLastRow();
  if (lastRow < 1) return bookedByCourse;

  // A열~E열 읽기 (B열=강좌명[index 1], E열=인원[index 4])
  var values = sheet.getRange(1, 1, lastRow, 5).getValues();
  for (var i = 0; i < values.length; i++) {
    var courseName = String(values[i][1] || "").trim();
    var peopleNum = Number(values[i][4]);

    // 머리글 행("강좌", "인원")이나 빈 행은 건너뜀
    if (!courseName || courseName === "강좌" || isNaN(peopleNum) || peopleNum <= 0) {
      continue;
    }
    bookedByCourse[courseName] = (bookedByCourse[courseName] || 0) + peopleNum;
  }
  return bookedByCourse;
}

// v2.1 실시간 좌석 현황 조회용 (GET 요청)
function doGet() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("예약");
    if (!sheet) {
      return ContentService
        .createTextOutput(JSON.stringify({ result: "ok", bookedByCourse: {} }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    var bookedByCourse = getCourseBookedMap_(sheet);
    return ContentService
      .createTextOutput(JSON.stringify({ result: "ok", bookedByCourse: bookedByCourse }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ result: "error", message: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// v1 & v2.1 공통 예약 접수용 (POST 요청)
function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    var data = JSON.parse(e.postData.contents);

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("예약");
    if (!sheet) {
      throw new Error('"예약" 시트를 찾을 수 없습니다.');
    }

    var courseName = String(data.course || "").trim();
    var requestedPeople = Number(data.people) || 0;
    var bookedByCourse = getCourseBookedMap_(sheet);
    var currentBooked = bookedByCourse[courseName] || 0;

    // v2.1에서 maxSeats(정원)를 함께 보낸 경우: 정원 초과 신청 원천 차단
    // (기존 v1 앱은 maxSeats를 보내지 않으므로 기존처럼 그대로 추가됨)
    if (data.maxSeats !== undefined && data.maxSeats !== null) {
      var maxSeats = Number(data.maxSeats);
      var remaining = Math.max(0, maxSeats - currentBooked);
      if (remaining === 0) {
        return ContentService
          .createTextOutput(JSON.stringify({
            result: "error",
            code: "SOLD_OUT",
            message: "해당 강좌는 정원이 마감되었습니다.",
            currentBooked: currentBooked
          }))
          .setMimeType(ContentService.MimeType.JSON);
      }
      if (requestedPeople > remaining) {
        return ContentService
          .createTextOutput(JSON.stringify({
            result: "error",
            code: "SOLD_OUT",
            message: "남은 좌석이 " + remaining + "석뿐입니다. " + remaining + "명 이하로 신청해 주세요.",
            currentBooked: currentBooked
          }))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }

    // A열 기준 실제 마지막 데이터 행 찾기 (표 서식/필터가 있어도 덮어쓰지 않고 무조건 다음 행에 추가)
    var colA = sheet.getRange("A:A").getValues();
    var lastDataRow = 0;
    for (var i = colA.length - 1; i >= 0; i--) {
      if (colA[i][0] !== "" && colA[i][0] !== null) {
        lastDataRow = i + 1;
        break;
      }
    }

    if (lastDataRow === 0) {
      sheet.getRange(1, 1, 1, 7).setValues([[
        "날짜", "강좌", "이름", "연락처", "인원", "결제 금액", "신청 시각"
      ]]);
      lastDataRow = 1;
    }

    var nextRow = lastDataRow + 1;
    sheet.getRange(nextRow, 1, 1, 7).setValues([[
      data.date,
      courseName,
      data.name,
      "'" + data.phone, // 앞자리 0 보존
      requestedPeople,
      data.total,
      Utilities.formatDate(new Date(), "Asia/Seoul", "yyyy-MM-dd HH:mm:ss")
    ]]);

    var newBooked = currentBooked + requestedPeople;

    return ContentService
      .createTextOutput(JSON.stringify({
        result: "ok",
        row: nextRow,
        currentBooked: newBooked
      }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ result: "error", message: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}
