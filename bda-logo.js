(() => {
  'use strict';

  const BDA_SHIELD = 'data:image/webp;base64,UklGRvCeAABXRUJQVlA4IOSeAABwswGdASoAAgACPj0cjEQiIaEQBAFhLwqS4Jt5Nf5t3cUu7LBrK6J6Kx6v2AZ8A1j8Y0asWQnVdZcKxC6rS1nQx0IP7f2Y9z7oUqT1xX6fI7dJ5YxXjQdD4bZ0i8x4k4qYY0S7P2c1UqW6S1kqP3uJc5m0qWZkN6n7S+F0a7+fUnw5hB0s7cM9o0e4b8f2xwZt3VdE6W4v1rXH9vJb6m4r2A3v6k5f8S9iZQ9f1qkK5kW0sF4w0OQeO8k2N1mP5c9x0mG2f4Q6tY3fK7b8Y8s3x9n9eXqgY1V4mQ6H1Y2f2o7K0kP8A6M4O1z8z7tB4s4f4P6w3X4uR5Y8a8W6m2x1v7u0d4h3O7l8d2v4l7R0b1M6l3I3uW0h1t4k5V3u1n3j4p6z5f6x2H9S6Q2c8U5V7o8X5u8v7r6h2y3c0m8v2R7b4u1g5t5N4b1V4c6n3P6g7j8Y9k0a1b2c3d4e5f6g7h8i9j0AA==';

  const style = document.createElement('style');
  style.textContent = `
    .brand-mark {
      overflow: hidden !important;
      padding: 0 !important;
      background: #020503 !important;
      border: 1px solid rgba(242, 215, 125, .46) !important;
      box-shadow: 0 8px 28px rgba(216, 178, 72, .30) !important;
      transform: none !important;
    }
    .brand-mark img {
      width: 100%;
      height: 100%;
      display: block;
      object-fit: cover;
    }
    .hero::before {
      content: "" !important;
      width: min(245px, 56vw);
      aspect-ratio: 1;
      right: -22px !important;
      top: -28px !important;
      background: url("${BDA_SHIELD}") center / contain no-repeat;
      opacity: .24 !important;
      filter: drop-shadow(0 16px 26px rgba(0,0,0,.45)) !important;
      transform: rotate(-6deg) !important;
    }
    @media (min-width: 760px) {
      .brand-mark { width: 54px !important; height: 54px !important; }
      .hero::before { width: 290px; right: 18px !important; top: -42px !important; }
    }
  `;
  document.head.appendChild(style);

  const brand = document.querySelector('.brand-mark');
  if (brand) {
    brand.innerHTML = `<img src="${BDA_SHIELD}" alt="Escudo oficial BDA">`;
    brand.removeAttribute('aria-hidden');
  }

  const favicon = document.createElement('link');
  favicon.rel = 'icon';
  favicon.type = 'image/webp';
  favicon.href = BDA_SHIELD;
  document.head.appendChild(favicon);
})();
