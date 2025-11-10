// Smooth scrolling for navigation links
document.addEventListener('DOMContentLoaded', function () {
  // Handle navigation link clicks
  const navLinks = document.querySelectorAll('.nav-link');
  navLinks.forEach((link) => {
    link.addEventListener('click', function (e) {
      e.preventDefault();
      const targetId = this.getAttribute('href');
      const targetSection = document.querySelector(targetId);

      if (targetSection) {
        targetSection.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
      }
    });
  });

  // Add scroll effect to header
  const header = document.querySelector('.header');
  let lastScrollY = window.scrollY;

  window.addEventListener('scroll', () => {
    const currentScrollY = window.scrollY;

    if (currentScrollY > lastScrollY && currentScrollY > 100) {
      // Scrolling down
      header.style.transform = 'translateY(-100%)';
    } else {
      // Scrolling up
      header.style.transform = 'translateY(0)';
    }

    lastScrollY = currentScrollY;
  });

  // Add intersection observer for fade-in animations
  const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px',
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = '1';
        entry.target.style.transform = 'translateY(0)';
      }
    });
  }, observerOptions);

  // Observe feature cards and steps
  const animatedElements = document.querySelectorAll(
    '.feature-card, .step, .flow-step'
  );
  animatedElements.forEach((el) => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(20px)';
    el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
    observer.observe(el);
  });

  // Add click tracking for analytics (if needed)
  const trackClick = (element, action) => {
    element.addEventListener('click', () => {
      // Add analytics tracking here if needed
      console.log(`Tracked: ${action}`);
    });
  };

  // Track download button clicks
  const downloadBtn = document.querySelector('.btn-primary');
  if (downloadBtn) {
    trackClick(downloadBtn, 'Download Button Clicked');
  }

  // Track installation guide clicks
  const installBtn = document.querySelector('.btn-secondary');
  if (installBtn) {
    trackClick(installBtn, 'Installation Guide Clicked');
  }

  // Add copy-to-clipboard functionality for code snippets (if any)
  const codeBlocks = document.querySelectorAll('code');
  codeBlocks.forEach((block) => {
    block.addEventListener('click', () => {
      navigator.clipboard.writeText(block.textContent).then(() => {
        // Show a temporary tooltip
        const tooltip = document.createElement('div');
        tooltip.textContent = 'Copied!';
        tooltip.style.cssText = `
                    position: absolute;
                    background: #1f2937;
                    color: white;
                    padding: 4px 8px;
                    border-radius: 4px;
                    font-size: 12px;
                    z-index: 1000;
                    pointer-events: none;
                `;

        document.body.appendChild(tooltip);

        const rect = block.getBoundingClientRect();
        tooltip.style.left = rect.left + 'px';
        tooltip.style.top = rect.top - 30 + 'px';

        setTimeout(() => {
          document.body.removeChild(tooltip);
        }, 2000);
      });
    });
  });

  // Add keyboard navigation support
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
      document.body.classList.add('keyboard-navigation');
    }
  });

  document.addEventListener('mousedown', () => {
    document.body.classList.remove('keyboard-navigation');
  });

  // Add loading animation for external links
  const externalLinks = document.querySelectorAll('a[href^="http"]');
  externalLinks.forEach((link) => {
    link.addEventListener('click', (e) => {
      // Add a small delay to show loading state
      const originalText = link.textContent;
      link.textContent = 'Loading...';
      link.style.opacity = '0.7';

      setTimeout(() => {
        link.textContent = originalText;
        link.style.opacity = '1';
      }, 1000);
    });
  });

  // Add theme toggle functionality (if needed in future)
  const createThemeToggle = () => {
    const toggle = document.createElement('button');
    toggle.innerHTML = '🌙';
    toggle.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            width: 50px;
            height: 50px;
            border-radius: 50%;
            border: none;
            background: #2563eb;
            color: white;
            font-size: 20px;
            cursor: pointer;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            z-index: 1000;
            transition: all 0.2s;
        `;

    toggle.addEventListener('click', () => {
      document.body.classList.toggle('dark-theme');
      toggle.innerHTML = document.body.classList.contains('dark-theme')
        ? '☀️'
        : '🌙';
    });

    document.body.appendChild(toggle);
  };

  // Uncomment to enable theme toggle
  // createThemeToggle();
});

// Add CSS for keyboard navigation
const style = document.createElement('style');
style.textContent = `
    .keyboard-navigation *:focus {
        outline: 2px solid #2563eb !important;
        outline-offset: 2px !important;
    }
    
    .dark-theme {
        background: #1f2937;
        color: #f9fafb;
    }
    
    .dark-theme .header {
        background: #111827;
    }
    
    .dark-theme .feature-card,
    .dark-theme .download-card {
        background: #374151;
        color: #f9fafb;
    }
`;
document.head.appendChild(style);
