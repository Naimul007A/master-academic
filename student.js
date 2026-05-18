function showStudent(){
  showScr('s-student'); curRole='student';
  localStorage.setItem('maac_role','student');
  localStorage.setItem('maac_data',JSON.stringify({student:curStudent}));
  $('stu-nm').textContent=`${curStudent.name} • ${curStudent.class}`;
  window._setupListeners&&window._setupListeners();
  renderStudent(); startClk('stuClk');
  // Refresh online status every 30s
  setInterval(()=>{ window.renderStats&&window.renderStats(); window.renderStudentsTable&&window.renderStudentsTable(); },30000);
  setTimeout(registerFCMToken, 1500);
  // Register online presence — immediately
  window._updatePresence&&window._updatePresence('student',curStudent.phone,{
    name:curStudent.name, class:curStudent.class
  });
}

// ══ FCM NOTIFICATION SETUP ══════════════════════════════════════════════════
