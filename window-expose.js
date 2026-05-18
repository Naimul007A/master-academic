// ── Expose ALL inline-onclick functions explicitly on window ──
// Required so onclick="fnName()" works in all browsers/PWA contexts.
window.setRole              = setRole;
window.loadTeacherDrop      = loadTeacherDrop;
window.doLogin              = doLogin;
window.doLogout             = doLogout;
window.toggleReg            = toggleReg;
window.onTeacherSelect      = onTeacherSelect;
window.teacherSetPin        = teacherSetPin;
window.adminResetPin        = adminResetPin;
window.adminSetTeacherRole  = adminSetTeacherRole;
window.aTab                 = aTab;
window.tTab                 = tTab;
window.stuTab               = stuTab;
window.mgrTab               = mgrTab;
window.addTeacher           = addTeacher;
window.addClass             = addClass;
window.addAlarm             = addAlarm;
window.toggleAlarm          = toggleAlarm;
window.postNotice           = postNotice;
window.uploadRoutine        = uploadRoutine;
window.uploadTeacherRoutine = uploadTeacherRoutine;
window.uploadResult         = uploadResult;
window.uploadSheet          = uploadSheet;
window.addStudentManual     = addStudentManual;
window.approveStudent       = approveStudent;
window.rejectStudent        = rejectStudent;
window.exportExcel          = exportExcel;
window.loadAttendanceStudents    = loadAttendanceStudents;
window.loadTeacherAttStudents    = loadTeacherAttStudents;
window.loadMgrAttStudents        = loadMgrAttStudents;
window.loadHwStudents            = loadHwStudents;
window.saveAttendance            = saveAttendance;
window.saveTeacherAttendance     = saveTeacherAttendance;
window.saveMgrAttendance         = saveMgrAttendance;
window.saveLeaderboard           = saveLeaderboard;
window.setAttMark                = setAttMark;
window.setTAttMark               = setTAttMark;
window.setMgrAttMark             = setMgrAttMark;
window.toggleHwDefaulter         = toggleHwDefaulter;
window.submitHwReport            = submitHwReport;
window.renderAttendanceAdmin     = renderAttendanceAdmin;
window.renderTeacherAttendanceAdmin = renderTeacherAttendanceAdmin;
window.renderHomeworkAdmin       = renderHomeworkAdmin;
window.renderTeacherOwnAttendance = renderTeacherOwnAttendance;
window.addHoliday                = addHoliday;
window.addExam                   = addExam;
window.addExamSubjectSlot        = addExamSubjectSlot;
window.addWeeklyTest             = addWeeklyTest;
window.addLeaderMarkRow          = addLeaderMarkRow;
window.syncLeaderSubject         = syncLeaderSubject;
window.addDueNotification        = addDueNotification;
window.addWeeklyTest             = addWeeklyTest;
window.openLB                    = openLB;
window.closeLB                   = closeLB;
window.openNoticeModal           = openNoticeModal;
window.closeNoticeModal          = closeNoticeModal;
window.closePDF                  = closePDF;
window.backToLogin               = backToLogin;
window.delDoc                    = delDoc;
window.filtSheets                = filtSheets;
window.toggleMonth               = toggleMonth;
window.dismissAlarm              = dismissAlarm;
window.dismissRem                = dismissRem;
window.dismissInappNotif         = dismissInappNotif;
window.populateTeacherSelect     = populateTeacherSelect;
window.renderMgrStudents         = renderMgrStudents;
window.renderMgrAttendance       = renderMgrAttendance;
window.renderMgrFinance          = renderMgrFinance;
window.renderMgrTeachers         = renderMgrTeachers;
window.renderMgrHomework         = renderMgrHomework;
window.renderMgrTeacherAtt       = renderMgrTeacherAtt;
window.mgrMarkStudentPaid        = mgrMarkStudentPaid;
window.mgrRecordFee              = mgrRecordFee;
window.mgrRecordExpense          = mgrRecordExpense;
window.finLoadStudents           = finLoadStudents;
window.finInitYears              = finInitYears;
window.isFeesPaid                = isFeesPaid;
window.renderAdminFinance        = renderAdminFinance;
window.exportAdminFinanceExcel   = exportAdminFinanceExcel;
window.closeFinEditModal         = closeFinEditModal;
window.adminOpenEditFee          = adminOpenEditFee;
window.adminOpenEditExpense      = adminOpenEditExpense;
window.adminSaveFinEdit          = adminSaveFinEdit;
window.adminDeleteFee            = adminDeleteFee;
window.adminDeleteExpense        = adminDeleteExpense;
window.adminAddFee               = adminAddFee;
window.adminAddExpense           = adminAddExpense;

// ── Reinforce tab clicks via event delegation (belt-and-suspenders fix) ──
document.addEventListener('DOMContentLoaded', function(){
  var tabs = document.querySelectorAll('.rtab');
  tabs.forEach(function(tab){
    tab.addEventListener('click', function(e){
      e.stopPropagation();
      var role = tab.getAttribute('data-role');
      if(role) window.setRole(role, tab);
    }, {passive:false});
  });
});

// ══════════════════════════════════════════════════════════════════════════════

// ══ DASHBOARD ══
window.renderDashboard   = window.renderDashboard;    // defined in dashboard.js
window._refreshDashboard = window._refreshDashboard;  // called by refreshAll
