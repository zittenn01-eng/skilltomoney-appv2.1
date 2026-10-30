import { courses } from "@/data/courses";

export async function GET() {
  const sheetUrl = process.env.SHEET_URL;
  if (!sheetUrl) {
    return Response.json({ ok: true, courses, synced: false });
  }

  try {
    const res = await fetch(sheetUrl, {
      method: "GET",
      redirect: "follow",
      cache: "no-store",
    });

    if (!res.ok) {
      return Response.json({ ok: true, courses, synced: false });
    }

    const text = await res.text();
    const json = JSON.parse(text);
    const bookedByCourse: Record<string, number> = json.bookedByCourse ?? {};

    const updatedCourses = courses.map((course) => {
      const sheetBooked = Number(bookedByCourse[course.name] ?? 0);
      const totalBooked = Number(course.booked ?? 0) + (Number.isFinite(sheetBooked) ? sheetBooked : 0);
      return {
        ...course,
        booked: Math.min(course.seat, Math.max(0, totalBooked)),
      };
    });

    return Response.json({ ok: true, courses: updatedCourses, synced: true });
  } catch {
    // Apps Script에 아직 doGet이 배포되지 않았거나 일시 오류일 경우 기본값 반환
    return Response.json({ ok: true, courses, synced: false });
  }
}
