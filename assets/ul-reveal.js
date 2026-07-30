const ulRevealObserver = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        entry.target.classList.add('ul-in-view');
        ulRevealObserver.unobserve(entry.target);
      }
    }
  },
  { threshold: 0.15 },
);

document.querySelectorAll('.ul-reveal:not(.ul-in-view)').forEach((el) => {
  ulRevealObserver.observe(el);
});
