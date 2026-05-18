// ============================================
// FILE: today-class.js
// ============================================
// Auto-fetches today's classes for each teacher based on day/date/time

(function() {
  window.renderTodayClasses = function(teacherName) {
    const container = document.getElementById('today-classes');
    if (!container) return;

    const today = new Date();
    const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][today.getDay()];
    const todayStr = today.toISOString().split('T')[0];
    const currentTime = today.getHours() * 60 + today.getMinutes();

    // Get all classes for this teacher
    const allClasses = window.appData.classes || [];
    const teacherClasses = allClasses.filter(c => c.teacher === teacherName);

    // Filter today's classes
    let todayClasses = teacherClasses.filter(c => c.day === dayName);

    // Check for special date-based classes (exam, holiday exceptions)
    const specialClasses = window.appData.examTimetable || [];
    const todayExams = specialClasses.filter(e => e.date === todayStr && e.teacher === teacherName);

    // Mark status for each class
    const classStatus = todayClasses.map(cls => {
      const [hour, minute] = cls.time.split(':').map(Number);
      const classTimeMinutes = hour * 60 + minute;
      
      let status = 'upcoming';
      if (classTimeMinutes < currentTime - 30) status = 'completed';
      else if (classTimeMinutes <= currentTime && classTimeMinutes > currentTime - 30) status = 'ongoing';
      else if (classTimeMinutes - currentTime <= 60 && classTimeMinutes > currentTime) status = 'soon';
      
      const timeUntil = classTimeMinutes - currentTime;
      let timeDisplay = '';
      if (status === 'soon') {
        const mins = Math.floor(timeUntil / 60);
        const secs = timeUntil % 60;
        timeDisplay = `in ${mins}m ${secs}s`;
      } else if (status === 'ongoing') {
        timeDisplay = '⏰ RUNNING NOW!';
      } else if (status === 'completed') {
        timeDisplay = '✓ Completed';
      } else {
        timeDisplay = `at ${fmt(cls.time)}`;
      }
      
      return { ...cls, status, timeDisplay };
    });

    // Sort by time
    classStatus.sort((a, b) => a.time.localeCompare(b.time));

    // Check for holidays
    const holidays = window.appData.holidays || [];
    const isHoliday = holidays.some(h => h.date === todayStr);
    const dayOfWeek = today.getDay();
    const isFriday = dayOfWeek === 5;

    let html = '';
    
    if (isHoliday) {
      const holiday = holidays.find(h => h.date === todayStr);
      html = `<div class="holiday-banner" style="background: linear-gradient(135deg,#e65100,#f57c00); border-radius: 14px; padding: 16px; text-align: center; margin-bottom: 16px;">
        <div style="font-size: 28px;">🏖️</div>
        <div style="font-weight: 800; font-size: 16px;">${holiday?.name || 'Holiday'}</div>
        <div style="font-size: 12px; opacity: 0.8;">No classes today</div>
      </div>`;
    } else if (isFriday) {
      html = `<div class="holiday-banner" style="background: linear-gradient(135deg,#2e7d32,#1b5e20); border-radius: 14px; padding: 16px; text-align: center; margin-bottom: 16px;">
        <div style="font-size: 28px;">🕌</div>
        <div style="font-weight: 800; font-size: 16px;">Friday (Weekly Holiday)</div>
        <div style="font-size: 12px; opacity: 0.8;">No classes scheduled</div>
      </div>`;
    } else if (classStatus.length === 0 && todayExams.length === 0) {
      html = `<div style="background: rgba(255,255,255,0.06); border-radius: 14px; padding: 24px; text-align: center;">
        <div style="font-size: 32px; margin-bottom: 8px;">🎉</div>
        <div style="font-weight: 700;">No classes today!</div>
        <div style="font-size: 12px; opacity: 0.6; margin-top: 4px;">Enjoy your day off</div>
      </div>`;
    } else {
      // Today's classes list
      html = `<div style="margin-bottom: 16px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
          <div style="font-family: 'Baloo 2', sans-serif; font-weight: 800; font-size: 14px;">📅 ${dayName}, ${todayStr}</div>
          <div style="font-size: 11px; background: rgba(255,255,255,0.1); padding: 4px 10px; border-radius: 20px;">${classStatus.length} class${classStatus.length !== 1 ? 'es' : ''}</div>
        </div>`;
      
      classStatus.forEach(cls => {
        const statusColors = {
          ongoing: { bg: '#e84040', color: '#fff', text: 'RUNNING' },
          soon: { bg: '#ff9800', color: '#fff', text: 'SOON' },
          upcoming: { bg: '#1a73e8', color: '#fff', text: 'UPCOMING' },
          completed: { bg: '#4caf50', color: '#fff', text: 'DONE' }
        };
        const style = statusColors[cls.status] || statusColors.upcoming;
        
        html += `
          <div style="background: rgba(255,255,255,0.06); border-radius: 12px; padding: 14px; margin-bottom: 10px; border-left: 4px solid ${style.bg};">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
              <div style="font-weight: 800; font-size: 16px;">${cls.subject}</div>
              <div style="background: ${style.bg}; color: ${style.color}; padding: 2px 10px; border-radius: 20px; font-size: 10px; font-weight: 700;">${style.text}</div>
            </div>
            <div style="font-size: 13px; opacity: 0.8;">${cls.class || 'General'} ${cls.room ? '• Room ' + cls.room : ''}</div>
            <div style="font-size: 12px; margin-top: 8px; color: ${cls.status === 'ongoing' ? '#ff9800' : 'inherit'}">
              ⏰ ${cls.timeDisplay}
            </div>
          </div>`;
      });
      
      // Add any exam classes
      if (todayExams.length) {
        html += `<div style="margin-top: 16px;">
          <div style="font-family: 'Baloo 2', sans-serif; font-weight: 800; font-size: 14px; margin-bottom: 8px;">📝 Today's Exams</div>`;
        todayExams.forEach(exam => {
          html += `
            <div style="background: rgba(255,152,0,0.1); border-radius: 12px; padding: 12px; margin-bottom: 8px; border-left: 4px solid #ff9800;">
              <div style="font-weight: 700;">${exam.subject}</div>
              <div style="font-size: 12px; opacity: 0.7;">${exam.examType} • ${exam.time || 'Time TBD'}</div>
            </div>`;
        });
        html += `</div>`;
      }
      
      html += `</div>`;
    }
    
    container.innerHTML = html;
    
    // Auto-refresh every minute (for countdown timers)
    if (window._todayClassInterval) clearInterval(window._todayClassInterval);
    window._todayClassInterval = setInterval(() => {
      if (document.querySelector('.screen.active')?.id === 's-teacher') {
        window.renderTodayClasses(teacherName);
      }
    }, 60000);
  };
})();