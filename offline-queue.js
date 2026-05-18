// ══════════════════════════════════════════════════════════════════════════════
// ══  FEATURE 3: OFFLINE ATTENDANCE QUEUE  ═══════════════════════════════════
// ══════════════════════════════════════════════════════════════════════════════

(function(){
  const QUEUE_KEY = 'maac_att_queue';

  function _loadQueue(){ try{ return JSON.parse(localStorage.getItem(QUEUE_KEY)||'[]'); }catch(e){ return []; } }
  function _saveQueue(q){ localStorage.setItem(QUEUE_KEY, JSON.stringify(q)); }

  function _updateBadge(){
    const q = _loadQueue();
    const badge = document.getElementById('offline-badge');
    const cnt   = document.getElementById('offline-count');
    if(badge) badge.style.display = (!navigator.onLine && q.length) ? 'block' : 'none';
    if(cnt)   cnt.textContent = q.length;
  }

  // Queue a write (setDoc) operation
  window._attQueuedWrite = async function(ref, data, op, docId, colName){
    const {setDoc} = window._fb;
    if(navigator.onLine){
      try{
        await Promise.race([
          setDoc(ref, data),
          new Promise((_,reject)=>setTimeout(()=>reject(new Error('Timeout')),7000))
        ]);
        return;
      }catch(e){
        // If online but write fails or times out, fall through to queue
        console.warn('[AttQueue] Online write failed/timeout, queuing:', e.message);
      }
    }
    // Offline — queue it
    const q = _loadQueue();
    // Deduplicate by docId+colName (replace existing queued item for same doc)
    const idx = q.findIndex(x=>x.docId===docId && x.colName===colName);
    const entry = {colName, docId, data, queuedAt:Date.now()};
    if(idx >= 0) q[idx] = entry; else q.push(entry);
    _saveQueue(q);
    _updateBadge();
    showToast('📴 Offline — Attendance queued. Will sync when online.');
  };

  async function _flushQueue(){
    const q = _loadQueue();
    if(!q.length) return;
    const {doc, setDoc} = window._fb;
    const failed = [];
    for(const entry of q){
      try{
        const ref = doc(window._db, entry.colName, entry.docId);
        await setDoc(ref, entry.data);
      }catch(e){
        console.warn('[AttQueue] Flush failed for', entry.docId, e.message);
        failed.push(entry);
      }
    }
    _saveQueue(failed);
    _updateBadge();
    const synced = q.length - failed.length;
    if(synced > 0) showToast(`✅ ${synced} queued attendance record${synced>1?'s':''} synced!`);
  }

  window.addEventListener('online',  ()=>{ _updateBadge(); _flushQueue(); });
  window.addEventListener('offline', _updateBadge);
  document.addEventListener('DOMContentLoaded', ()=>{ _updateBadge(); if(navigator.onLine) _flushQueue(); });
})();

// ══ Expose new functions on window ══
window.startQrScanner    = window.startQrScanner;
window.stopQrScanner     = window.stopQrScanner;
window.markScanAtt       = window.markScanAtt;
window.runAutoAbsentNow  = window.runAutoAbsentNow;
window.generateAdminQR   = window.generateAdminQR;
window.printAdminQR      = window.printAdminQR;
window._attQueuedWrite   = window._attQueuedWrite;
</script>
