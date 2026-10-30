"use client";

import { useState, useEffect } from "react";
import { courses as initialCoursesData } from "@/data/courses";

interface Course {
  id: string;
  name: string;
  price: number;
  seat: number;
  booked: number;
  date: string;
  tags: string[];
  badge?: string;
  originalPrice?: number;
  description?: string;
  duration?: string;
  target?: string;
  curriculumHighlights?: string[];
  icon?: string;
  isPopular?: boolean;
}

export default function Home() {
  const [courses, setCourses] = useState<Course[]>(initialCoursesData);
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [applicantName, setApplicantName] = useState("");
  const [applicantPhone, setApplicantPhone] = useState("");
  const [applicantPeople, setApplicantPeople] = useState<number | string>(1);
  const [submitting, setSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState("");
  const [loadingSeats, setLoadingSeats] = useState(true);

  // 구글 시트 실시간 예약 인원 동기화 함수
  const fetchLiveCourses = async () => {
    try {
      const res = await fetch("/api/courses", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        if (data.ok && Array.isArray(data.courses)) {
          setCourses(data.courses);
          setSelectedCourse((prev) =>
            prev ? data.courses.find((c: Course) => c.id === prev.id) ?? prev : null
          );
        }
      }
    } catch {
      // 오프라인 또는 초기 상태 시 기본 데이터 유지
    } finally {
      setLoadingSeats(false);
    }
  };

  // 페이지 진입 시 구글 시트 실시간 예약 현황 불러오기
  useEffect(() => {
    fetchLiveCourses();
  }, []);

  // 예약 가능한 강좌만 보기 필터링 (남은 좌석이 1석 이상인 강좌만 표시)
  const displayedCourses = onlyAvailable
    ? courses.filter((course) => (Number(course.seat) - Number(course.booked)) > 0)
    : courses;

  const handleOpenReservation = (course: Course) => {
    setSelectedCourse(course);
    setApplicantName("");
    setApplicantPhone("");
    setApplicantPeople(1);
    setSubmitMessage("");
  };

  const handleCloseModal = () => {
    setSelectedCourse(null);
    setApplicantName("");
    setApplicantPhone("");
    setApplicantPeople(1);
    setSubmitMessage("");
  };

  // 금액(total)은 서버가 계산하므로 courseId, 이름, 연락처, 인원만 보낸다
  const handleApply = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedCourse || submitting) return;

    const currentRemaining = Math.max(0, Number(selectedCourse.seat) - Number(selectedCourse.booked));
    if (currentRemaining === 0) {
      setSubmitMessage("⚠️ 정원이 마감되어 신청할 수 없습니다.");
      return;
    }
    if (!applicantName.trim() || !applicantPhone.trim()) {
      setSubmitMessage("⚠️ 이름과 연락처를 모두 입력해 주세요.");
      return;
    }
    const requestedPeople = Number(applicantPeople);
    if (!Number.isInteger(requestedPeople) || requestedPeople < 1) {
      setSubmitMessage("⚠️ 인원을 1명 이상 입력해 주세요.");
      return;
    }
    if (requestedPeople > currentRemaining) {
      setSubmitMessage(`⚠️ 남은 좌석이 ${currentRemaining}석뿐입니다. ${currentRemaining}명 이하로 입력해 주세요.`);
      return;
    }

    setSubmitting(true);
    setSubmitMessage("⏳ 예약을 전송하고 있습니다...");
    try {
      const res = await fetch("/api/reserve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId: selectedCourse.id,
          name: applicantName,
          phone: applicantPhone,
          people: requestedPeople,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        const nextBooked =
          typeof data.booked === "number"
            ? data.booked
            : Math.min(selectedCourse.seat, Number(selectedCourse.booked) + requestedPeople);

        setCourses((prev) =>
          prev.map((c) => (c.id === selectedCourse.id ? { ...c, booked: nextBooked } : c))
        );
        setSelectedCourse((prev) => (prev ? { ...prev, booked: nextBooked } : null));
        setSubmitMessage(
          `✅ 신청이 접수되었습니다. (결제 금액 ${Number(data.total).toLocaleString()}원)`
        );
        // 최신 시트 현황 재동기화
        fetchLiveCourses();
      } else {
        if (typeof data.booked === "number") {
          setCourses((prev) =>
            prev.map((c) => (c.id === selectedCourse.id ? { ...c, booked: data.booked } : c))
          );
          setSelectedCourse((prev) => (prev ? { ...prev, booked: data.booked } : null));
        }
        setSubmitMessage(`⚠️ ${data.error ?? "신청에 실패했습니다."}`);
      }
    } catch {
      setSubmitMessage("⚠️ 네트워크 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#070e1e] text-white selection:bg-amber-500 selection:text-slate-950">
      {/* 배경 은은한 골드 & 딥 네이비 앰비언트 라이트 */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[340px] sm:w-[680px] h-[340px] sm:h-[680px] bg-gradient-to-b from-amber-500/10 via-blue-600/10 to-transparent rounded-full blur-[120px]" />
        <div className="absolute top-1/2 -left-20 w-[240px] sm:w-[450px] h-[240px] sm:h-[450px] bg-amber-400/5 rounded-full blur-[100px]" />
        <div className="absolute bottom-10 right-0 w-[280px] sm:w-[500px] h-[280px] sm:h-[500px] bg-blue-500/10 rounded-full blur-[120px]" />
      </div>

      {/* 헤더 */}
      <header className="sticky top-0 z-40 backdrop-blur-md bg-[#070e1e]/85 border-b border-amber-500/20 px-4 sm:px-8 py-3.5 sm:py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 via-yellow-400 to-amber-300 flex items-center justify-center font-black text-slate-950 shadow-lg shadow-amber-500/30 text-base">
              S
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-base sm:text-lg tracking-tight text-white leading-tight">
                  스킬투머니
                </span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-400/15 text-amber-300 border border-amber-400/30">
                  원데이 클래스
                </span>
              </div>
              <p className="text-[11px] text-amber-200/70 hidden sm:block">
                배운 기술이 돈이 되는 실전 원데이 클래스
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <span className="text-xs text-amber-200/80 hidden md:inline">
              🌟 실시간 잔여 좌석 확인 및 예약
            </span>
            <button
              onClick={() => {
                setOnlyAvailable(true);
                document.getElementById("courses")?.scrollIntoView({ behavior: "smooth" });
              }}
              className="text-xs sm:text-sm font-bold px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-full bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 hover:from-amber-400 hover:to-yellow-300 shadow-md shadow-amber-500/20 transition-all duration-200 cursor-pointer"
            >
              강좌 목록 보기
            </button>
          </div>
        </div>
      </header>

      {/* 메인 콘텐츠 영역 */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 md:px-8 pt-10 sm:pt-16 pb-24">
        {/* 상단 소개 타이틀 섹션 */}
        <section className="text-center flex flex-col items-center mb-12 sm:mb-16">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/10 border border-amber-400/30 text-amber-300 text-xs sm:text-sm font-medium mb-4">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>
            <span>단 하루 만에 완성하는 실전 스킬 수익화</span>
          </div>

          <h1 className="text-3xl sm:text-5xl md:text-6xl font-black tracking-tight text-white mb-3 leading-tight">
            스킬투머니 <span className="bg-gradient-to-r from-amber-200 via-yellow-400 to-amber-500 bg-clip-text text-transparent">강좌 목록</span>
          </h1>

          <p className="text-base sm:text-xl text-amber-100/90 font-medium max-w-2xl mb-4">
            배운 기술이 돈이 되는 원데이 클래스
          </p>

          <p className="text-xs sm:text-sm text-slate-400 max-w-lg leading-relaxed">
            소수 정예 밀착 코칭으로 진행되는 원데이 클래스입니다. 좌석이 한정되어 있으니 조기 마감에 유의해 주세요.
          </p>
        </section>

        {/* 파이썬 코드 실행 결과와 1:1 매칭되는 실시간 현황 콘솔 배너 */}
        <section className="mb-10 p-4 sm:p-5 rounded-2xl bg-[#0b1325] border border-amber-500/25 max-w-3xl mx-auto shadow-lg">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-white/10 text-xs">
            <span className="font-mono text-amber-400 font-bold flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block animate-pulse"></span>
              〈화면 출력 결과〉 실시간 동기화 {loadingSeats ? "(좌석 불러오는 중...)" : "(구글 시트 연동됨)"}
            </span>
            <button
              type="button"
              onClick={fetchLiveCourses}
              className="text-amber-300 hover:text-white font-mono text-[11px] px-2 py-0.5 rounded bg-amber-500/10 border border-amber-400/30 transition-colors cursor-pointer"
            >
              ↻ 새로고침
            </button>
          </div>
          <div className="space-y-1.5 font-mono text-xs sm:text-sm">
            {courses.map((course) => {
              const left = course.seat - course.booked;
              const state = left === 0 ? "[마감]" : left <= 2 ? "[마감 임박]" : "";
              return (
                <div key={course.id} className="flex flex-wrap items-center justify-between text-slate-200">
                  <span>
                    <strong className="text-white font-bold">{course.name}</strong> {course.price} 원 / 남은 자리 {left} 석
                  </span>
                  {state && (
                    <span
                      className={`font-bold px-2 py-0.5 rounded text-xs ${
                        left === 0
                          ? "bg-slate-800 text-slate-400 border border-slate-700"
                          : "bg-red-500/20 text-red-400 border border-red-500/50"
                      }`}
                    >
                      {state}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* 강좌 카드 목록 섹션 */}
        <section id="courses" className="scroll-mt-24">
          {/* 강좌 목록 상단: "예약 가능한 강좌만 보기" 체크 상자 컨트롤 바 */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6 p-4 rounded-2xl bg-[#0b1325]/80 border border-amber-500/20 backdrop-blur-sm shadow-md">
            <div className="flex items-center gap-2.5">
              <input
                type="checkbox"
                id="filter-only-available"
                checked={onlyAvailable}
                onChange={(e) => setOnlyAvailable(e.target.checked)}
                className="w-5 h-5 rounded-md border-2 border-amber-400/50 bg-slate-900 text-amber-500 focus:ring-2 focus:ring-amber-400/30 focus:ring-offset-0 focus:outline-none accent-amber-500 cursor-pointer transition-all"
              />
              <label
                htmlFor="filter-only-available"
                className="text-sm font-bold text-slate-200 hover:text-amber-300 transition-colors cursor-pointer select-none"
              >
                예약 가능한 강좌만 보기
              </label>
            </div>

            <span className="text-xs font-medium text-amber-200/70">
              총 <strong className="text-white font-bold">{displayedCourses.length}</strong>개 강좌 표시 중
              {onlyAvailable && (
                <span className="ml-1 text-emerald-400 font-semibold">(마감 강좌 제외)</span>
              )}
            </span>
          </div>

          {displayedCourses.length === 0 ? (
            <div className="p-12 text-center rounded-3xl bg-[#0b1325]/50 border border-dashed border-amber-500/25">
              <span className="text-3xl mb-2 block">📋</span>
              <p className="text-sm text-slate-300 font-bold mb-1">
                현재 예약 가능한 강좌가 없습니다.
              </p>
              <p className="text-xs text-slate-400">
                체크를 풀면 모든 강좌 목록과 취소표 대기 신청을 확인하실 수 있습니다.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {displayedCourses.map((course) => {
              // 파이썬 로직과 1:1 대응: left = seats[i] - booked[i]
              const left = course.seat - course.booked;
              const isSoldOut = left === 0;
              const isUrgent = left >= 1 && left <= 2;
              const state = isSoldOut ? "[마감]" : isUrgent ? "[마감 임박]" : "";

              return (
                <div
                  key={course.id}
                  className={`relative flex flex-col justify-between rounded-3xl p-6 sm:p-7 transition-all duration-300 ${
                    isSoldOut
                      ? "bg-gradient-to-b from-[#0a0f1d] to-[#070b16] border border-slate-800 opacity-90 shadow-md"
                      : course.isPopular
                      ? "bg-gradient-to-b from-[#131f38] to-[#0d162a] border-2 border-amber-400/70 shadow-xl shadow-amber-500/15 sm:-translate-y-2"
                      : "bg-gradient-to-b from-[#0f172a] to-[#0a1122] border border-amber-500/25 hover:border-amber-400/50 shadow-lg shadow-black/40"
                  }`}
                >
                  {/* 인기 뱃지 (AI 자동화) */}
                  {course.isPopular && !isSoldOut && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-3.5 py-1 rounded-full bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 text-xs font-black tracking-wide shadow-md shadow-amber-500/30">
                      BEST 강좌
                    </div>
                  )}

                  {/* 카드 상단: 아이콘, 뱃지, 강좌 이름 */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-3xl sm:text-4xl">{course.icon || "🎯"}</span>
                      {course.badge && (
                        <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-amber-400/10 text-amber-300 border border-amber-400/30">
                          {course.badge}
                        </span>
                      )}
                    </div>

                    <h2 className="text-2xl sm:text-2xl font-black text-white mb-2 tracking-tight">
                      {course.name}
                    </h2>

                    {/* 강좌 이름 아래 작은 태그 배지 목록 */}
                    {course.tags && course.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-3.5">
                        {course.tags.map((tag, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-400/10 text-amber-300 border border-amber-400/30 tracking-tight shadow-sm"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}

                    {course.description && (
                      <p className="text-xs sm:text-sm text-slate-300 leading-relaxed mb-4 min-h-[40px]">
                        {course.description}
                      </p>
                    )}

                    {/* 수강료 영역 */}
                    <div className="p-4 rounded-2xl bg-[#070e1e]/80 border border-amber-500/20 mb-4">
                      <div className="flex items-baseline justify-between">
                        <span className="text-xs text-slate-400">수강료</span>
                        <div className="text-right">
                          {course.originalPrice && (
                            <span className="text-xs text-slate-400 line-through mr-2">
                              {course.originalPrice.toLocaleString()}원
                            </span>
                          )}
                          <span className="text-2xl sm:text-3xl font-black text-amber-400">
                            {course.price.toLocaleString()}
                          </span>
                          <span className="text-sm font-bold text-amber-300 ml-1">원</span>
                        </div>
                      </div>
                      <div className="mt-2 flex items-center justify-between text-[11px] text-amber-200/70 border-t border-white/5 pt-2">
                        <span>개강 일정</span>
                        <span className="font-semibold text-slate-200">{course.date}</span>
                      </div>
                      {course.duration && (
                        <div className="mt-1 flex items-center justify-between text-[11px] text-amber-200/70">
                          <span>수강 시간</span>
                          <span className="font-semibold text-slate-200">{course.duration}</span>
                        </div>
                      )}
                    </div>

                    {/* 정원 및 남은 자리 표시 영역 (파이썬 코드와 1:1 일치) */}
                    <div
                      className={`p-3.5 rounded-2xl bg-gradient-to-r from-slate-900/90 to-[#0c1527] mb-5 shadow-inner border ${
                        isSoldOut
                          ? "border-slate-800"
                          : isUrgent
                          ? "border-red-500/40 bg-red-950/20"
                          : "border-amber-500/30"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-bold text-slate-300">좌석 현황</span>
                        {/* 상태: left == 0이면 [마감], left <= 2이면 [마감 임박], 그 외 예약 가능 */}
                        {isSoldOut ? (
                          <span className="text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                            {state}
                          </span>
                        ) : isUrgent ? (
                          <span className="text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-red-500/25 text-red-400 border border-red-500/60 animate-pulse">
                            {state}
                          </span>
                        ) : (
                          <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                            예약 가능
                          </span>
                        )}
                      </div>

                      <div className="text-sm sm:text-base font-black text-white flex items-center justify-between">
                        <span
                          className={
                            isSoldOut
                              ? "text-slate-400"
                              : isUrgent
                              ? "text-red-400 font-extrabold"
                              : "text-amber-300"
                          }
                        >
                          남은 자리 {left} 석 {state && <span className="ml-1">{state}</span>}
                        </span>
                        <span className="text-xs text-slate-400 font-normal">
                          (정원 {course.seat}명 / 예약 {course.booked}명)
                        </span>
                      </div>

                      {/* 좌석 게이지 바 */}
                      <div className="w-full h-1.5 bg-slate-800 rounded-full mt-2 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            isSoldOut
                              ? "bg-slate-600"
                              : isUrgent
                              ? "bg-red-500"
                              : "bg-gradient-to-r from-blue-500 to-amber-400"
                          }`}
                          style={{
                            width: `${Math.min(
                              100,
                              (course.booked / course.seat) * 100
                            )}%`,
                          }}
                        />
                      </div>
                    </div>

                    {/* 핵심 커리큘럼 포인트 */}
                    {course.curriculumHighlights && course.curriculumHighlights.length > 0 && (
                      <div className="space-y-2 mb-6">
                        <div className="text-xs font-bold text-amber-300 uppercase tracking-wider mb-2">
                          커리큘럼 핵심 포인트
                        </div>
                        {course.curriculumHighlights.map((point, idx) => (
                          <div key={idx} className="flex items-start gap-2 text-xs text-slate-300">
                            <span className="text-amber-400 font-bold shrink-0">✓</span>
                            <span>{point}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* 카드 하단 액션 버튼 */}
                  <div className="mt-4 pt-4 border-t border-white/10">
                    <button
                      onClick={() => handleOpenReservation(course)}
                      disabled={isSoldOut}
                      className={`w-full py-3.5 px-4 rounded-2xl font-black text-sm tracking-wide transition-all duration-200 ${
                        isSoldOut
                          ? "bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed"
                          : isUrgent
                          ? "bg-gradient-to-r from-red-500 via-amber-500 to-yellow-400 hover:from-red-400 hover:to-yellow-300 text-slate-950 shadow-lg shadow-red-500/25 cursor-pointer"
                          : "bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 shadow-lg shadow-amber-500/20 cursor-pointer"
                      }`}
                    >
                      {isSoldOut ? "정원 마감" : "예약하기"}
                    </button>
                    <p className="text-[11px] text-center text-slate-400 mt-2">
                      {isSoldOut
                        ? "⚡ 정원 마감 완료 · 취소석 발생 시 즉시 연락"
                        : "✓ 실전 템플릿 제공 & 1:1 Q&A 포함"}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

        {/* 혜택 안내 배너 */}
        <section className="mt-14 sm:mt-20 p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-amber-500/10 via-amber-400/5 to-transparent border border-amber-500/30">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4 text-left">
              <div className="w-12 h-12 rounded-2xl bg-amber-400/20 border border-amber-400/40 flex items-center justify-center text-2xl shrink-0">
                🎁
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-bold text-white mb-1">
                  모든 수강생 100% 무료 혜택
                </h3>
                <p className="text-xs sm:text-sm text-slate-300">
                  수업 후 바로 활용 가능한 실전 템플릿 패키지 + 1:1 맞춤 피드백 권한 무료 증정
                </p>
              </div>
            </div>
            <div className="text-center sm:text-right shrink-0">
              <span className="inline-block px-3 py-1 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-300 text-xs font-bold">
                1기 한정 혜택
              </span>
            </div>
          </div>
        </section>
      </main>

      {/* 예약 신청 모달 팝업 */}
      {selectedCourse && (
        <div
          onClick={handleCloseModal}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-md rounded-3xl bg-gradient-to-b from-[#111c34] to-[#091122] border-2 border-amber-400/50 p-6 sm:p-8 shadow-2xl shadow-amber-500/20 max-h-[92vh] overflow-y-auto"
          >
            {/* 상단 닫기 (X) 버튼 */}
            <button
              onClick={handleCloseModal}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 flex items-center justify-center text-sm font-bold transition-colors cursor-pointer"
              aria-label="닫기"
            >
              ✕
            </button>

            <div className="mb-5">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-xl">📅</span>
                <span className="text-xs font-bold px-2 py-0.5 rounded bg-amber-400/15 text-amber-300 border border-amber-400/30">
                  원데이 클래스 예약
                </span>
              </div>
              <h3 className="text-xl sm:text-2xl font-black text-white">
                예약 신청
              </h3>
            </div>

            <form onSubmit={handleApply} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  강좌 이름
                </label>
                <input
                  type="text"
                  value={selectedCourse.name}
                  readOnly
                  className="w-full px-4 py-3 rounded-xl bg-slate-900/60 border border-slate-700 text-amber-300 font-bold text-sm cursor-not-allowed select-none focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  날짜
                </label>
                <input
                  type="text"
                  value={selectedCourse.date}
                  readOnly
                  className="w-full px-4 py-3 rounded-xl bg-slate-900/60 border border-slate-700 text-slate-200 font-medium text-sm cursor-not-allowed select-none focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  이름
                </label>
                <input
                  type="text"
                  placeholder="이름을 입력하세요"
                  value={applicantName}
                  onChange={(e) => setApplicantName(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-slate-900/90 border border-amber-500/30 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-amber-400 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  연락처
                </label>
                <input
                  type="tel"
                  placeholder="010-1234-5678"
                  value={applicantPhone}
                  onChange={(e) => setApplicantPhone(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-slate-900/90 border border-amber-500/30 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-amber-400 transition-colors"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-slate-300">
                    인원 (숫자)
                  </label>
                  <span className="text-xs font-bold text-amber-300">
                    현재 잔여 좌석: {Math.max(0, selectedCourse.seat - selectedCourse.booked)}석
                  </span>
                </div>
                <input
                  type="number"
                  min={1}
                  max={Math.max(1, selectedCourse.seat - selectedCourse.booked)}
                  placeholder="인원 수 입력"
                  value={applicantPeople}
                  onChange={(e) => {
                    if (e.target.value === "") {
                      setApplicantPeople("");
                      return;
                    }
                    const maxLeft = Math.max(1, selectedCourse.seat - selectedCourse.booked);
                    setApplicantPeople(Math.min(maxLeft, Math.max(1, Number(e.target.value))));
                  }}
                  className="w-full px-4 py-3 rounded-xl bg-slate-900/90 border border-amber-500/30 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-amber-400 transition-colors"
                />
              </div>

              {submitMessage && (
                <p className="text-xs font-semibold text-amber-200">{submitMessage}</p>
              )}

              <div className="pt-3 flex gap-3">
                <button
                  type="submit"
                  disabled={submitting || selectedCourse.seat - selectedCourse.booked <= 0}
                  className="flex-1 py-3.5 rounded-xl font-black bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 text-sm shadow-lg shadow-amber-500/25 transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {submitting
                    ? "전송 중..."
                    : selectedCourse.seat - selectedCourse.booked <= 0
                    ? "마감됨"
                    : "신청"}
                </button>
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="flex-1 py-3.5 rounded-xl font-bold bg-white/10 hover:bg-white/15 text-slate-300 text-sm transition-colors cursor-pointer"
                >
                  닫기
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 하단 푸터 */}
      <footer className="border-t border-amber-500/20 py-8 px-4 text-center text-xs text-slate-400">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-bold text-white">스킬투머니</span>
            <span className="text-amber-500/40">|</span>
            <span className="text-amber-200/70">배운 기술이 돈이 되는 원데이 클래스</span>
          </div>
          <p>© 2026 스킬투머니. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
