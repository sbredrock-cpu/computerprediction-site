// Marks the current page in the main navigation.
(function () {
  const page = document.querySelector('header.nav')?.dataset.page;
  document.querySelectorAll('[data-nav]').forEach((a) => {
    if (a.dataset.nav === page) a.setAttribute('aria-current', 'page');
  });
})();

// Scoreboard: say "Yesterday" only when the latest graded day really was yesterday.
(function () {
  var row = document.querySelector('.sb-row[data-date]');
  if (!row) return;
  var d = new Date(), y = new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1);
  var ys = y.getFullYear() + '-' + String(y.getMonth() + 1).padStart(2, '0') + '-' + String(y.getDate()).padStart(2, '0');
  if (row.getAttribute('data-date') !== ys) row.querySelector('.sb-k').firstChild.nodeValue = 'Last graded day';
})();

// Sticky "free pick" button: shows once the email form has scrolled out of view.
(function () {
  var form = document.getElementById('unlock'), btn = document.querySelector('.sticky-cta');
  if (!form || !btn || !('IntersectionObserver' in window)) return;
  new IntersectionObserver(function (e) {
    var past = !e[0].isIntersecting && e[0].boundingClientRect.top < 0;
    btn.classList.toggle('show', past);
  }).observe(form);
})();
