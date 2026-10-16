/* Aplica o tema salvo antes de a página aparecer (evita o piscar). */
try{var t=localStorage.getItem('controlhub-theme');if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t);}catch(e){}
