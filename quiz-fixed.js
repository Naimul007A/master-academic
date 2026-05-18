// ============================================
// FILE: quiz-fixed.js
// ============================================
// Complete quiz generation system - NO API KEY NEEDED

(function() {
  
  // Simple question generator from text (no Gemini API)
  function generateQuestionsFromText(text, numQuestions) {
    const questions = [];
    
    // Split text into sentences
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 15);
    if (sentences.length === 0) {
      return [{
        question: "What is the main topic of this text?",
        type: "mcq",
        options: ["Option A", "Option B", "Option C", "Option D"],
        answer: "Option A",
        marks: 1
      }];
    }
    
    // Extract important words (potential answers)
    const words = text.toLowerCase().match(/\b[a-z]{4,}\b/g) || [];
    const wordFrequency = {};
    words.forEach(w => { wordFrequency[w] = (wordFrequency[w] || 0) + 1; });
    const importantWords = Object.entries(wordFrequency)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(entry => entry[0]);
    
    // Generate different types of questions
    for (let i = 0; i < Math.min(numQuestions, sentences.length + 5); i++) {
      const sentence = sentences[i % sentences.length].trim();
      if (sentence.length < 10) continue;
      
      const questionType = i % 3; // 0: MCQ, 1: True/False, 2: Fill in blank
      
      if (questionType === 0 && importantWords.length > 0) {
        // MCQ Question
        const keyword = importantWords[i % importantWords.length];
        const lowerSentence = sentence.toLowerCase();
        
        if (lowerSentence.includes(keyword)) {
          // Create distractor options
          const distractors = importantWords
            .filter(w => w !== keyword && w.length > 3)
            .slice(0, 3);
          
          while (distractors.length < 3) {
            distractors.push("related concept");
          }
          
          questions.push({
            question: sentence,
            type: "mcq",
            options: [keyword, ...distractors],
            answer: keyword,
            marks: 1
          });
        } else {
          questions.push({
            question: sentence + "?",
            type: "mcq",
            options: ["True", "False", "Maybe", "Not sure"],
            answer: "True",
            marks: 1
          });
        }
      } 
      else if (questionType === 1) {
        // True/False Question
        const isTrue = Math.random() > 0.3;
        questions.push({
          question: sentence + "?",
          type: "truefalse",
          options: ["True", "False"],
          answer: isTrue ? "True" : "False",
          marks: 1
        });
      } 
      else {
        // Fill in the blank
        const words_sent = sentence.split(' ');
        if (words_sent.length > 4) {
          const blankIndex = Math.floor(words_sent.length / 2);
          const answerWord = words_sent[blankIndex];
          words_sent[blankIndex] = '______';
          questions.push({
            question: words_sent.join(' '),
            type: "fillblank",
            options: [answerWord, "Unknown", "None", "All of above"],
            answer: answerWord,
            marks: 1
          });
        }
      }
    }
    
    // Ensure we have at least 5 questions
    while (questions.length < 5 && questions.length < numQuestions) {
      questions.push({
        question: `Question ${questions.length + 1}: Based on the study material, what is the key takeaway?`,
        type: "mcq",
        options: ["Option A", "Option B", "Option C", "Option D"],
        answer: "Option A",
        marks: 1
      });
    }
    
    return questions.slice(0, numQuestions);
  }
  
  // Main quiz generation function (replaces the broken one)
  window.generateQuizQuestions = async function() {
    const textarea = document.getElementById('quiz-text-preview');
    const text = textarea?.value?.trim();
    
    if (!text) {
      showToast('❌ No text found! First upload and extract text from a file.');
      return;
    }
    
    if (text.length < 50) {
      showToast('⚠️ Text is too short. Please upload a longer document.');
      return;
    }
    
    const numQuestions = parseInt(document.getElementById('quiz-num-questions')?.value || '10');
    const btn = document.getElementById('quiz-generate-btn');
    const status = document.getElementById('quiz-gen-status');
    
    if (btn) {
      btn.disabled = true;
      btn.textContent = '⏳ Generating...';
    }
    if (status) status.textContent = '📝 Creating questions from your text...';
    
    // Simulate processing delay for better UX
    await new Promise(r => setTimeout(r, 500));
    
    try {
      // Generate questions
      const questions = generateQuestionsFromText(text, numQuestions);
      
      // Store globally
      window._quizQuestions = questions;
      
      // Render editor
      renderQuizEditor(questions);
      
      // Show editor panel
      const editor = document.getElementById('quiz-questions-editor');
      if (editor) editor.style.display = 'block';
      
      if (status) {
        status.textContent = `✅ ${questions.length} questions generated! Review and edit below.`;
        status.style.color = '#4caf50';
      }
      
      showToast(`✅ ${questions.length} questions generated successfully!`);
      
      // Scroll to editor
      editor?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      
    } catch (error) {
      console.error('Generation error:', error);
      if (status) {
        status.textContent = '❌ Failed to generate questions. Please try again.';
        status.style.color = '#f44336';
      }
      showToast('❌ Generation failed: ' + error.message);
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = '🤖 Generate Questions with AI';
      }
    }
  };
  
  // Render quiz editor
  function renderQuizEditor(questions) {
    const container = document.getElementById('quiz-questions-list');
    if (!container) return;
    
    container.innerHTML = questions.map((q, i) => `
      <div class="quiz-q-card" id="qqc-${i}" style="background: rgba(255,255,255,0.05); border-radius: 12px; padding: 15px; margin-bottom: 12px;">
        <div class="quiz-q-num" style="display: flex; align-items: center; gap: 8px; margin-bottom: 10px;">
          <span style="font-weight: 800;">Q${i + 1}</span>
          <span class="quiz-q-type-badge" style="background: #1a73e8; color: white; padding: 2px 8px; border-radius: 12px; font-size: 11px;">${q.type || 'mcq'}</span>
          <button onclick="window.deleteQuizQuestion(${i})" style="margin-left: auto; background: rgba(232,64,64,0.2); border: none; color: #e84040; padding: 4px 12px; border-radius: 8px; cursor: pointer;">✕ Delete</button>
        </div>
        <textarea class="quiz-q-text" id="qq-text-${i}" rows="2" style="width: 100%; padding: 10px; border-radius: 8px; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); color: white; margin-bottom: 10px;">${escapeHtml(q.question)}</textarea>
        <div class="quiz-opts" id="qq-opts-${i}">
          ${(q.options || ['', '', '', '']).map((opt, j) => `
            <div class="quiz-opt-row" style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
              <input type="radio" name="qq-ans-${i}" value="${escapeHtml(opt)}" id="qq-r-${i}-${j}" ${q.answer === opt ? 'checked' : ''} style="margin: 0;">
              <input type="text" class="quiz-opt-inp" value="${escapeHtml(opt)}" id="qq-opt-${i}-${j}" placeholder="Option ${j + 1}" style="flex: 1; padding: 8px 12px; border-radius: 8px; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); color: white;">
              <label for="qq-r-${i}-${j}" class="quiz-ans-lbl" style="font-size: 11px; cursor: pointer;">✓ Correct</label>
            </div>
          `).join('')}
        </div>
        <div style="display: flex; align-items: center; gap: 8px; margin-top: 8px;">
          <label style="font-size: 11px; opacity: 0.7;">MARKS:</label>
          <input type="number" value="${q.marks || 1}" min="1" max="10" id="qq-marks-${i}" style="width: 60px; padding: 5px; border-radius: 6px; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); color: white; text-align: center;">
        </div>
      </div>
    `).join('');
  }
  
  // Helper function
  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
      if (m === '&') return '&amp;';
      if (m === '<') return '&lt;';
      if (m === '>') return '&gt;';
      return m;
    });
  }
  
  // Delete question
  window.deleteQuizQuestion = function(index) {
    if (window._quizQuestions && window._quizQuestions[index]) {
      window._quizQuestions.splice(index, 1);
      renderQuizEditor(window._quizQuestions);
      showToast('Question deleted');
    }
  };
  
  // Add new question
  window.addQuizQuestion = function() {
    if (!window._quizQuestions) window._quizQuestions = [];
    window._quizQuestions.push({
      question: "New question?",
      type: "mcq",
      options: ["Option A", "Option B", "Option C", "Option D"],
      answer: "Option A",
      marks: 1
    });
    renderQuizEditor(window._quizQuestions);
    showToast('New question added');
  };
  
  // Publish quiz
  window.publishQuiz = async function() {
    const title = document.getElementById('quiz-title')?.value?.trim();
    const desc = document.getElementById('quiz-desc')?.value?.trim();
    const timeLimit = parseInt(document.getElementById('quiz-time-limit')?.value || '30');
    const targetClass = document.getElementById('quiz-target-class')?.value || 'All';
    
    if (!title) {
      showToast('❌ Please enter a quiz title');
      return;
    }
    
    if (!window._quizQuestions || window._quizQuestions.length === 0) {
      showToast('❌ No questions to publish');
      return;
    }
    
    // Collect current questions from editor
    const questions = [];
    for (let i = 0; i < window._quizQuestions.length; i++) {
      const qText = document.getElementById(`qq-text-${i}`)?.value || window._quizQuestions[i].question;
      const marks = parseInt(document.getElementById(`qq-marks-${i}`)?.value || '1');
      const options = [];
      for (let j = 0; j < 4; j++) {
        const opt = document.getElementById(`qq-opt-${i}-${j}`)?.value;
        if (opt) options.push(opt);
      }
      
      // Find selected answer
      let answer = window._quizQuestions[i].answer;
      const radios = document.querySelectorAll(`input[name="qq-ans-${i}"]`);
      radios.forEach((r, idx) => {
        if (r.checked) answer = options[idx] || r.value;
      });
      
      questions.push({
        question: qText,
        type: options.length === 2 && options[0] === 'True' && options[1] === 'False' ? 'truefalse' : 'mcq',
        options: options,
        answer: answer,
        marks: marks,
        index: i
      });
    }
    
    const totalMarks = questions.reduce((sum, q) => sum + q.marks, 0);
    const quizId = Date.now().toString(36) + Math.random().toString(36).substr(2, 6);
    
    const btn = document.getElementById('quiz-publish-btn');
    if (btn) {
      btn.disabled = true;
      btn.textContent = '⏳ Publishing...';
    }
    
    try {
      const { doc, setDoc, collection } = window._fb;
      
      // Save quiz metadata
      await setDoc(doc(window._db, 'quizzes', quizId), {
        id: quizId,
        title: title,
        description: desc || '',
        timeLimit: timeLimit,
        targetClass: targetClass,
        totalMarks: totalMarks,
        questionCount: questions.length,
        status: 'active',
        createdBy: window.curTeacher || 'teacher',
        createdAt: Date.now()
      });
      
      // Save questions as subcollection
      for (const q of questions) {
        await setDoc(doc(window._db, 'quizzes', quizId, 'questions', q.index.toString()), q);
      }
      
      showToast(`✅ Quiz "${title}" published!`);
      
      // Show share panel
      const baseUrl = window.location.origin + window.location.pathname;
      const shareLink = `${baseUrl}?quiz=${quizId}`;
      window._lastQuizLink = shareLink;
      
      const sharePanel = document.getElementById('quiz-share-panel');
      if (sharePanel) {
        sharePanel.style.display = 'block';
        const linkEl = document.getElementById('quiz-share-link');
        if (linkEl) linkEl.textContent = shareLink;
        
        if (typeof QRCode !== 'undefined') {
          const qrCanvas = document.getElementById('quiz-qr-canvas');
          if (qrCanvas) {
            QRCode.toCanvas(qrCanvas, shareLink, { width: 180, margin: 2 });
          }
        }
        sharePanel.scrollIntoView({ behavior: 'smooth' });
      }
      
    } catch (error) {
      console.error('Publish error:', error);
      showToast('❌ Failed to publish: ' + error.message);
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = '📤 Publish Quiz';
      }
    }
  };
  
  // Fix the button click handler
  window.fixQuizButtons = function() {
    const generateBtn = document.getElementById('quiz-generate-btn');
    if (generateBtn) {
      // Remove all existing listeners
      const newBtn = generateBtn.cloneNode(true);
      generateBtn.parentNode.replaceChild(newBtn, generateBtn);
      newBtn.onclick = window.generateQuizQuestions;
      newBtn.id = 'quiz-generate-btn';
    }
    
    const addBtn = document.getElementById('quiz-add-btn');
    if (addBtn) {
      const newAddBtn = addBtn.cloneNode(true);
      addBtn.parentNode.replaceChild(newAddBtn, addBtn);
      newAddBtn.onclick = window.addQuizQuestion;
    }
    
    const publishBtn = document.getElementById('quiz-publish-btn');
    if (publishBtn) {
      const newPublishBtn = publishBtn.cloneNode(true);
      publishBtn.parentNode.replaceChild(newPublishBtn, publishBtn);
      newPublishBtn.onclick = window.publishQuiz;
    }
  };
  
  // Initialize on page load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', window.fixQuizButtons);
  } else {
    window.fixQuizButtons();
  }
  
})();