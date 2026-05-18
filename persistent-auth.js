// ============================================
// FILE: persistent-auth.js
// ============================================
// Fix: Use localStorage + session persistence without re-authentication

(function() {
  // Store session with longer expiry
  const SESSION_KEY = 'maac_session';
  const SESSION_EXPIRY = 30 * 24 * 60 * 60 * 1000; // 30 days

  window.saveManagerSession = function(teacherData) {
    const session = {
      teacherId: teacherData.id,
      teacherName: teacherData.name,
      role: teacherData.role || 'manager',
      pinVersion: teacherData.pinVersion,
      lastLogin: Date.now(),
      expires: Date.now() + SESSION_EXPIRY
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    localStorage.setItem('maac_role', 'teacher');
    localStorage.setItem('maac_data', JSON.stringify({
      teacher: teacherData.name,
      pinVersion: teacherData.pinVersion,
      role: teacherData.role
    }));
  };

  window.restoreManagerSession = async function() {
    const sessionStr = localStorage.getItem(SESSION_KEY);
    if (!sessionStr) return null;
    
    const session = JSON.parse(sessionStr);
    if (Date.now() > session.expires) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }

    // Verify teacher still exists and PIN hasn't changed
    const teacher = window.appData.teachers?.find(t => t.id === session.teacherId);
    if (!teacher || teacher.pinVersion !== session.pinVersion) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }

    return teacher;
  };

  // Auto-restore session on page load (no Firebase Auth needed)
  window.autoRestoreManager = async function() {
    const teacher = await window.restoreManagerSession();
    if (teacher && (teacher.role === 'manager' || teacher.role === 'chairman')) {
      curTeacher = teacher.name;
      showManager(teacher.role);
      return true;
    }
    return false;
  };

  // Modified login function - bypasses Firebase Auth for managers
  window.managerLogin = async function(teacherName, pin) {
    const teacher = window.appData.teachers.find(t => t.name === teacherName);
    if (!teacher) {
      showToast('Teacher not found');
      return false;
    }
    
    const pinHash = await sha256(pin);
    if (pinHash !== teacher.pinHash) {
      showToast('Invalid PIN');
      return false;
    }
    
    // Save session (no Firebase Auth needed)
    window.saveManagerSession(teacher);
    curTeacher = teacher.name;
    
    if (teacher.role === 'manager' || teacher.role === 'chairman') {
      showManager(teacher.role);
    } else {
      showTeacher();
    }
    return true;
  };
})();

// Update doLogin function for teachers (remove anonymous auth)
// In core.js, replace teacher login section:
/*
} else if (curRole === 'teacher') {
  const t = $('l-teacher').value;
  const pin = $('l-teacher-pin').value.trim();
  if (!t || !pin) { showToast('Select teacher and enter PIN'); return; }
  
  // Wait for teachers data
  let retries = 0;
  while (!window.appData.teachers.length && retries < 20) {
    await new Promise(r => setTimeout(r, 300));
    retries++;
  }
  
  await window.managerLogin(t, pin);  // ← Use new function
  return;
}
*/