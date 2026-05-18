// ============================================
// FILE: quiz-fallback.js
// ============================================
// Alternative quiz generation without Gemini API

(function() {
  // Simple rule-based question generator (no API needed)
  window.generateQuizOffline = function(text, numQ) {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 20);
    const questions = [];
    
    // Extract keywords (simple noun phrase detection)
    const words = text.toLowerCase().split(/\s+/);
    const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'of', 'to', 'in', 'for', 'on', 'with', 'by', 'at', 'from', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'having', 'do', 'does', 'did', 'doing']);
    const keywords = [...new Set(words.filter(w => w.length > 4 && !stopWords.has(w)))].slice(0, 20);
    
    for (let i = 0; i < Math.min(numQ, sentences.length); i++) {
      const sentence = sentences[i].trim();
      if (sentence.length < 10) continue;
      
      // Find a keyword in the sentence
      const foundKeyword = keywords.find(k => sentence.toLowerCase().includes(k));
      if (!foundKeyword) continue;
      
      // Create a fill-in-the-blank question
      const blankPos = sentence.toLowerCase().indexOf(foundKeyword);
      const questionText = sentence.substring(0, blankPos) + '______' + sentence.substring(blankPos + foundKeyword.length);
      
      questions.push({
        question: questionText.trim(),
        type: 'fillblank',
        options: [foundKeyword, `Not ${foundKeyword}`, `Related to ${foundKeyword}`, 'None of the above'],
        answer: foundKeyword,
        marks: 1,
        explanation: `The correct term is "${foundKeyword}"`
      });
    }
    
    // Add some simple true/false questions
    for (let i = 0; i < Math.floor(numQ / 3); i++) {
      const randomSentence = sentences[Math.floor(Math.random() * sentences.length)];
      if (randomSentence && randomSentence.length > 15) {
        const isTrue = Math.random() > 0.5;
        questions.push({
          question: `${randomSentence.substring(0, 100)}?`,
          type: 'truefalse',
          options: ['True', 'False'],
          answer: isTrue ? 'True' : 'False',
          marks: 1
        });
      }
    }
    
    return questions.slice(0, numQ);
  };
  
  // Modified quiz generation with fallback
  window.quizGenerateWithFallback = async function() {
    const text = (_el('quiz-text-preview') || {}).value?.trim();
    if (!text) { _toast('❌ No text to generate from.'); return; }
    
    const numQ = parseInt((_el('quiz-num-questions') || {}).value) || 20;
    const btn = _el('quiz-generate-btn');
    const status = _el('quiz-gen-status');
    
    if (btn) btn.disabled = true;
    if (status) status.textContent = '⏳ Generating questions...';
    
    try {
      let questions;
      try {
        // Try Gemini first
        questions = await generateQuizWithGemini(text, numQ);
        if (status) status.textContent = `✅ ${questions.length} questions generated via AI!`;
      } catch (geminiError) {
        console.warn('Gemini failed, using offline fallback:', geminiError);
        if (status) status.textContent = '⚠️ AI unavailable, using offline generator...';
        
        // Fallback to offline generator
        questions = window.generateQuizOffline(text, numQ);
        if (status) status.textContent = `📝 ${questions.length} questions generated (offline mode). Edit as needed.`;
        _toast('⚠️ Using offline quiz generator (no API key needed)');
      }
      
      if (!questions || questions.length === 0) {
        throw new Error('No questions could be generated');
      }
      
      _quizQuestions = questions;
      renderQuizEditor(questions);
      const editor = _el('quiz-questions-editor');
      if (editor) editor.style.display = 'block';
      
    } catch (e) {
      _toast('❌ ' + e.message);
      if (status) status.textContent = '❌ ' + e.message;
    } finally {
      if (btn) btn.disabled = false;
    }
  };
  
  // Replace the generate button handler
  window.quizGenerateAI = window.quizGenerateWithFallback;
})();