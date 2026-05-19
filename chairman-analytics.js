// ============================================
// FILE: chairman-analytics.js
// ============================================
// Analytics Dashboard for Chairman (Simple stats, no charts)

(function() {
  window.renderChairmanAnalytics = function() {
    const container = document.getElementById('chairman-analytics');
    if (!container) return;

    const students = window.appData.students || [];
    const teachers = window.appData.teachers || [];
    const attendance = window.appData.attendance || [];
    const fees = window.appData.fees || [];
    const expenses = window.appData.expenses || [];
    const homework = window.appData.homework || [];
    const dues = window.appData.dueNotifications || [];

    // Calculate stats
    const now = new Date();
    const thisMonth = now.toLocaleString('default', { month: 'long' });
    const thisYear = now.getFullYear();

    // Monthly attendance rate
    const thisMonthAttendance = attendance.filter(a => a.month === thisMonth);
    let totalPresent = 0, totalRecords = 0;
    thisMonthAttendance.forEach(day => {
      Object.values(day.records || {}).forEach(mark => {
        if (mark === 'P') totalPresent++;
        totalRecords++;
      });
    });
    const attendanceRate = totalRecords ? Math.round((totalPresent / totalRecords) * 100) : 0;

    // Monthly fee collection
    const thisMonthFees = fees.filter(f => f.month === thisMonth && f.year == thisYear);
    const monthlyCollection = thisMonthFees.reduce((sum, f) => sum + (f.amount || 0), 0);

    // Monthly expenses
    const thisMonthExpenses = expenses.filter(e => {
      const expDate = e.date ? new Date(e.date) : null;
      return expDate && expDate.getMonth() === now.getMonth() && expDate.getFullYear() === thisYear;
    });
    const monthlyExpenses = thisMonthExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);

    // Net profit
    const netProfit = monthlyCollection - monthlyExpenses;

    // Homework defaulters this month
    const hwThisMonth = homework.filter(h => {
      const hwDate = h.date ? new Date(h.date) : null;
      return hwDate && hwDate.getMonth() === now.getMonth();
    });
    const totalDefaulters = hwThisMonth.reduce((sum, h) => sum + (h.defaulterCount || 0), 0);
    const uniqueDefaulters = new Set(hwThisMonth.flatMap(h => h.defaulterNames || [])).size;

    // Fee defaulters (students with due notifications)
    const feeDefaulters = dues.length;

    // Online presence
    const fiveMinAgo = Date.now() - 10 * 60 * 1000;
    const presence = window.appData.presence || [];
    const onlineStudents = presence.filter(p => p.role === 'student' && p.online && p.lastSeen > fiveMinAgo).length;
    const onlineTeachers = presence.filter(p => p.role === 'teacher' && p.online && p.lastSeen > fiveMinAgo).length;

    // Teacher attendance this month
    const teacherAtt = window.appData.teacherAttendance || [];
    const tAttThisMonth = teacherAtt.filter(a => a.month === thisMonth);
    let tPresent = 0, tTotal = 0;
    tAttThisMonth.forEach(day => {
      Object.values(day.records || {}).forEach(mark => {
        if (mark === 'P') tPresent++;
        tTotal++;
      });
    });
    const teacherAttRate = tTotal ? Math.round((tPresent / tTotal) * 100) : 0;

    // Pending approvals
    const pendingCount = (window.appData.pending || []).length;

    // Class-wise student count
    const classCount = {};
    students.forEach(s => {
      classCount[s.class] = (classCount[s.class] || 0) + 1;
    });

    // Gender stats (if you add gender field, otherwise skip)
    const genderStats = { male: 0, female: 0, other: 0 };
    students.forEach(s => {
      if (s.gender === 'male') genderStats.male++;
      else if (s.gender === 'female') genderStats.female++;
      else genderStats.other++;
    });

    container.innerHTML = `
      <div style="padding: 16px;">
        <!-- Summary Cards -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; margin-bottom: 24px;">
          <div style="background: linear-gradient(135deg, #1a3a5e, #1a5e9e); border-radius: 16px; padding: 14px; color: white;">
            <div style="font-size: 28px; font-weight: 800;">${students.length}</div>
            <div style="font-size: 11px; opacity: 0.92;">Total Students</div>
            <div style="font-size: 10px; margin-top: 6px;">👧 ${genderStats.female} | 👦 ${genderStats.male}</div>
          </div>
          <div style="background: linear-gradient(135deg, #2e5a3a, #1b5e20); border-radius: 16px; padding: 14px; color: white;">
            <div style="font-size: 28px; font-weight: 800;">${teachers.length}</div>
            <div style="font-size: 11px; opacity: 0.92;">Total Teachers</div>
          </div>
          <div style="background: linear-gradient(135deg, #5a3a1a, #8a5a0a); border-radius: 16px; padding: 14px; color: white;">
            <div style="font-size: 28px; font-weight: 800;">${onlineStudents + onlineTeachers}</div>
            <div style="font-size: 11px; opacity: 0.92;">Currently Online</div>
            <div style="font-size: 10px; margin-top: 6px;">🎓 ${onlineStudents} students | 👨‍🏫 ${onlineTeachers} teachers</div>
          </div>
          <div style="background: linear-gradient(135deg, #3a1a6e, #5e2a9e); border-radius: 16px; padding: 14px; color: white;">
            <div style="font-size: 28px; font-weight: 800;">${attendanceRate}%</div>
            <div style="font-size: 11px; opacity: 0.92;">Attendance Rate (${thisMonth})</div>
          </div>
        </div>

        <!-- Finance Overview -->
        <div style="background: rgba(255,255,255,0.06); border-radius: 16px; padding: 16px; margin-bottom: 20px; border: 1px solid rgba(255,255,255,0.1);">
          <div style="font-family: 'Baloo 2', sans-serif; font-weight: 800; font-size: 14px; margin-bottom: 14px;">💰 Finance Overview (${thisMonth})</div>
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; text-align: center;">
            <div>
              <div style="font-size: 20px; font-weight: 800; color: #4caf50;">৳${monthlyCollection.toLocaleString()}</div>
              <div style="font-size: 10px; opacity: 0.80;">Collections</div>
            </div>
            <div>
              <div style="font-size: 20px; font-weight: 800; color: #f44336;">৳${monthlyExpenses.toLocaleString()}</div>
              <div style="font-size: 10px; opacity: 0.80;">Expenses</div>
            </div>
            <div>
              <div style="font-size: 20px; font-weight: 800; color: ${netProfit >= 0 ? '#4caf50' : '#f44336'};">${netProfit >= 0 ? '+' : ''}৳${netProfit.toLocaleString()}</div>
              <div style="font-size: 10px; opacity: 0.80;">Net Profit</div>
            </div>
          </div>
        </div>

        <!-- Attendance & Discipline -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; margin-bottom: 20px;">
          <div style="background: rgba(255,255,255,0.06); border-radius: 12px; padding: 12px;">
            <div style="font-size: 12px; font-weight: 700; opacity: 0.92; margin-bottom: 6px;">👨‍🏫 Teacher Attendance</div>
            <div style="font-size: 24px; font-weight: 800;">${teacherAttRate}%</div>
            <div style="font-size: 10px; opacity: 0.80;">${thisMonth}</div>
          </div>
          <div style="background: rgba(255,255,255,0.06); border-radius: 12px; padding: 12px;">
            <div style="font-size: 12px; font-weight: 700; opacity: 0.92; margin-bottom: 6px;">📝 Homework Defaulters</div>
            <div style="font-size: 24px; font-weight: 800;">${uniqueDefaulters}</div>
            <div style="font-size: 10px; opacity: 0.80;">${totalDefaulters} total occurrences</div>
          </div>
          <div style="background: rgba(255,255,255,0.06); border-radius: 12px; padding: 12px;">
            <div style="font-size: 12px; font-weight: 700; opacity: 0.92; margin-bottom: 6px;">⚠️ Fee Defaulters</div>
            <div style="font-size: 24px; font-weight: 800;">${feeDefaulters}</div>
            <div style="font-size: 10px; opacity: 0.80;">students with dues</div>
          </div>
          <div style="background: rgba(255,255,255,0.06); border-radius: 12px; padding: 12px;">
            <div style="font-size: 12px; font-weight: 700; opacity: 0.92; margin-bottom: 6px;">⏳ Pending Approvals</div>
            <div style="font-size: 24px; font-weight: 800;">${pendingCount}</div>
            <div style="font-size: 10px; opacity: 0.80;">students waiting</div>
          </div>
        </div>

        <!-- Class Distribution -->
        <div style="background: rgba(255,255,255,0.06); border-radius: 16px; padding: 16px;">
          <div style="font-family: 'Baloo 2', sans-serif; font-weight: 800; font-size: 14px; margin-bottom: 12px;">📚 Class Distribution</div>
          <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); gap: 8px;">
            ${Object.entries(classCount).map(([className, count]) => `
              <div style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid rgba(255,255,255,0.08);">
                <span style="font-size: 12px;">${className}</span>
                <span style="font-size: 14px; font-weight: 700; color: #4caf50;">${count}</span>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  };
})();
