import { courses } from "@/data/courses";

export async function POST(request: Request) {
  const sheetUrl = process.env.SHEET_URL;
  if (!sheetUrl) {
    return Response.json({ ok: false, error: "서버 설정 오류" }, { status: 500 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "잘못된 요청" }, { status: 400 });
  }

  const courseId = String(body.courseId ?? "");
  const name = String(body.name ?? "").trim();
  const phone = String(body.phone ?? "").trim();
  const people = Number(body.people);

  const course = courses.find((c) => c.id === courseId);
  if (!course) {
    return Response.json({ ok: false, error: "강좌를 찾을 수 없습니다." }, { status: 404 });
  }
  if (!name || !phone || !Number.isInteger(people) || people < 1) {
    return Response.json({ ok: false, error: "입력값을 확인해 주세요." }, { status: 400 });
  }

  // 1차 잔여 좌석 검증 (Apps Script에 doGet이 배포된 경우 현재 시트 인원 조회)
  try {
    const checkRes = await fetch(sheetUrl, {
      method: "GET",
      redirect: "follow",
      cache: "no-store",
    });
    if (checkRes.ok) {
      const checkJson = JSON.parse(await checkRes.text());
      const bookedByCourse: Record<string, number> = checkJson.bookedByCourse ?? {};
      const currentBooked = Number(course.booked ?? 0) + Number(bookedByCourse[course.name] ?? 0);
      const remaining = Math.max(0, course.seat - currentBooked);

      if (remaining === 0) {
        return Response.json(
          { ok: false, error: "해당 강좌는 정원이 마감되었습니다.", booked: course.seat },
          { status: 409 }
        );
      }
      if (people > remaining) {
        return Response.json(
          {
            ok: false,
            error: `남은 좌석이 ${remaining}석뿐입니다. ${remaining}명 이하로 신청해 주세요.`,
            booked: currentBooked,
          },
          { status: 409 }
        );
      }
    }
  } catch {
    // doGet 미지원 구버전 스크립트일 경우 POST의 maxSeats 검증 또는 시트 기록으로 진행
  }

  // 결제 금액은 화면 값이 아니라 서버의 강좌 데이터로 계산
  const total = course.price * people;

  try {
    const res = await fetch(sheetUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      redirect: "follow",
      body: JSON.stringify({
        date: course.date,
        course: course.name,
        name,
        phone,
        people,
        total,
        maxSeats: course.seat - Number(course.booked ?? 0), // v2.1 동시성 정원 검증용 (v1 스크립트에서는 자동 무시됨)
      }),
    });

    if (!res.ok) {
      return Response.json(
        { ok: false, error: `시트 전송 실패 (HTTP ${res.status})` },
        { status: 502 }
      );
    }

    const text = await res.text();
    let updatedBooked: number | undefined;
    try {
      const sheetJson = JSON.parse(text);
      if (sheetJson.result === "error" || sheetJson.ok === false) {
        return Response.json(
          {
            ok: false,
            error: sheetJson.message || sheetJson.error || "신청 처리 중 오류가 발생했습니다.",
            booked:
              typeof sheetJson.currentBooked === "number"
                ? Number(course.booked ?? 0) + sheetJson.currentBooked
                : undefined,
          },
          { status: sheetJson.code === "SOLD_OUT" ? 409 : 502 }
        );
      }
      if (typeof sheetJson.currentBooked === "number") {
        updatedBooked = Math.min(course.seat, Number(course.booked ?? 0) + sheetJson.currentBooked);
      }
    } catch {
      if (text.includes("<!DOCTYPE html>") || text.includes("<html")) {
        return Response.json(
          {
            ok: false,
            error: "구글 웹 앱 권한 오류입니다. 배포 관리에서 액세스 권한을 '모든 사용자'로 설정하고 새 버전으로 배포해 주세요.",
          },
          { status: 502 }
        );
      }
    }

    return Response.json({ ok: true, total, booked: updatedBooked });
  } catch (err) {
    return Response.json(
      { ok: false, error: `시트 전송 실패: ${err instanceof Error ? err.message : "네트워크 오류"}` },
      { status: 502 }
    );
  }
}
