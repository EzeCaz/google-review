/* global window, document, fetch */
/**
 * Noovi Google Reviews — Storefront embed script.
 *
 * Usage on the Shopify storefront (Custom Liquid block or theme.liquid):
 *
 *   <div id="noovi-reviews-root"></div>
 *   <script
 *     src="https://YOUR-APP-HOST/embed.js?shop=noovi-co.myshopify.com"
 *     async
 *   ></script>
 *
 * The script:
 *   1. Reads ?shop= from its own <script src> URL.
 *   2. GETs https://YOUR-APP-HOST/api/reviews/public?shop=...
 *   3. Renders a fast, dependency-free carousel into #noovi-reviews-root.
 *      - Desktop and mobile card sizes driven by the merchant's admin config.
 *      - Average rating + total reviews header.
 *      - Profile picture, stars, name, date, review text per card.
 *   4. Re-fetches every 5 minutes so daily refresh is reflected without
 *      a page reload if the customer keeps the tab open.
 */
(function () {
  'use strict'

  function qs(name) {
    var scripts = document.getElementsByTagName('script')
    for (var i = 0; i < scripts.length; i++) {
      var src = scripts[i].src || ''
      if (src.indexOf('/embed.js') === -1) continue
      var q = src.split('?')[1] || ''
      var pairs = q.split('&')
      for (var j = 0; j < pairs.length; j++) {
        var kv = pairs[j].split('=')
        if (decodeURIComponent(kv[0]) === name) return decodeURIComponent(kv[1] || '')
      }
    }
    // Fallback to data-shop on the script tag
    for (var k = 0; k < scripts.length; k++) {
      if ((scripts[k].src || '').indexOf('/embed.js') !== -1) {
        return scripts[k].getAttribute('data-shop') || ''
      }
    }
    return ''
  }

  function getScriptUrl() {
    var scripts = document.getElementsByTagName('script')
    for (var i = 0; i < scripts.length; i++) {
      if ((scripts[i].src || '').indexOf('/embed.js') !== -1) return scripts[i].src
    }
    return ''
  }

  // Resolve the app origin from the embed script's own src.
  function getOrigin() {
    var src = getScriptUrl()
    if (!src) return ''
    try {
      var u = new URL(src, window.location.href)
      return u.origin
    } catch (e) {
      return ''
    }
  }

  function starSvg(filled, size, color) {
    var fill = filled ? color : 'none'
    var stroke = filled ? 'none' : '#ccc'
    return (
      '<svg viewBox="0 0 122.88 116.864" width="' + size + '" height="' + size + '"' +
      ' style="display:block" xmlns="http://www.w3.org/2000/svg">' +
      '<polygon fill="' + fill + '" stroke="' + stroke + '" stroke-width="4" ' +
      'points="61.44,0 78.351,41.326 122.88,44.638 88.803,73.491 99.412,116.864 ' +
      '61.44,93.371 23.468,116.864 34.078,73.491 0,44.638 44.529,41.326 61.44,0" />' +
      '</svg>'
    )
  }

  function renderStars(rating, size, color) {
    var html = '<div style="display:flex;gap:2px">'
    for (var i = 1; i <= 5; i++) {
      html += starSvg(i <= Math.round(rating), size, color)
    }
    html += '</div>'
    return html
  }

  // Google "G" badge (small, blue/green/yellow icon) to indicate source.
  function googleBadgeSvg(size) {
    return (
      '<svg viewBox="-3 0 262 262" width="' + size + '" height="' + size + '"' +
      ' xmlns="http://www.w3.org/2000/svg" aria-label="Google">' +
      '<path fill="#4285F4" d="M255.878 133.451c0-10.734-.871-18.567-2.756-26.69H130.55v48.448h71.947c-1.45 12.04-9.283 30.172-26.69 42.356l-.244 1.622 38.755 30.023 2.685.268c24.659-22.774 38.875-56.282 38.875-96.027"/>' +
      '<path fill="#34A853" d="M130.55 261.1c35.248 0 64.839-11.605 86.453-31.622l-41.196-31.913c-11.024 7.688-25.82 13.055-45.257 13.055-34.523 0-63.824-22.773-74.269-54.25l-1.531.13-40.298 31.187-.527 1.465C35.393 231.798 79.49 261.1 130.55 261.1"/>' +
      '<path fill="#FBBC05" d="M56.281 156.37c-2.756-8.123-4.351-16.827-4.351-25.82 0-8.994 1.595-17.697 4.206-25.82l-.073-1.73L15.26 71.312l-1.335.635C5.077 89.644 0 109.517 0 130.55s5.077 40.905 13.925 58.602l42.356-32.782"/>' +
      '<path fill="#EB4335" d="M130.55 50.479c24.514 0 41.05 10.589 50.479 19.438l36.844-35.974C195.245 12.91 165.798 0 130.55 0 79.49 0 35.393 29.301 13.925 71.947l42.211 32.783c10.59-31.477 39.891-54.251 74.414-54.251"/>' +
      '</svg>'
    )
  }

  function fmtDate(iso, locale) {
    try {
      var d = new Date(iso)
      return d.toLocaleDateString(locale || 'he-IL', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    } catch (e) {
      return ''
    }
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
  }

  function buildCard(r, cfg) {
    var photo = r.photo
      ? '<img src="' + escapeHtml(r.photo) + '" alt="' + escapeHtml(r.author) +
        '" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" />'
      : '<div style="width:100%;height:100%;border-radius:50%;background:' +
        cfg.cardBg + ';display:flex;align-items:center;justify-content:center;color:' +
        cfg.cardTextColor + ';font-size:18px;font-weight:600;">' +
        escapeHtml((r.author || '?').slice(0, 1)) + '</div>'

    var authorLink = r.authorUrl
      ? '<a href="' + escapeHtml(r.authorUrl) + '" target="_blank" rel="noreferrer" ' +
        'style="color:inherit;text-decoration:none;">' + escapeHtml(r.author) + '</a>'
      : escapeHtml(r.author)

    var dateStr = fmtDate(r.publishedAt, cfg.rtl ? 'he-IL' : 'en-US')

    return (
      '<div class="noovi-rev-card" ' +
      'style="background:' + cfg.cardBg + ';color:' + cfg.cardTextColor + ';' +
      'border-radius:10px;padding:16px;display:flex;flex-direction:column;gap:10px;' +
      'min-height:' + cfg.cardHeight + 'px;' +
      'box-shadow:0 1px 2px rgba(0,0,0,0.04);">' +
        '<div style="display:flex;align-items:center;gap:12px;">' +
          '<div style="position:relative;width:44px;height:44px;flex:0 0 auto;">' +
            '<div style="width:44px;height:44px;border-radius:50%;overflow:hidden;border:1px solid rgba(0,0,0,0.06);">' +
              photo +
            '</div>' +
            '<span style="position:absolute;bottom:-2px;left:-2px;background:white;border-radius:50%;' +
            'padding:2px;display:flex;align-items:center;justify-content:center;">' +
              googleBadgeSvg(14) +
            '</span>' +
          '</div>' +
          '<div style="flex:1 1 auto;min-width:0;line-height:1.2;">' +
            '<div style="font-weight:600;font-size:15px;">' + authorLink + '</div>' +
            '<div style="font-size:12px;opacity:0.7;">' + escapeHtml(dateStr) + '</div>' +
          '</div>' +
        '</div>' +
        '<div>' + renderStars(r.rating, 17, cfg.accentColor) + '</div>' +
        '<div style="font-size:14px;line-height:1.55;' +
        'overflow:hidden;display:-webkit-box;-webkit-line-clamp:6;' +
        '-webkit-box-orient:vertical;">' + escapeHtml(r.text) + '</div>' +
      '</div>'
    )
  }

  function buildHeader(payload) {
    var s = payload.shop
    var cfg = s.config

    var logoUrl = 'https://assets.entanglecommerce.com/google-review-assets/place/noovi-co.myshopify.com/logo/1776255838_69df835e59fae.jpeg'
    var reviewsUrl = 'https://search.google.com/local/reviews?placeid=' + encodeURIComponent(s.placeId || '')

    var badge =
      '<div class="noovi-rev-badge" style="display:flex;align-items:center;gap:12px;' +
        'padding:8px 14px;border-radius:10px;background:white;' +
        'box-shadow:0 1px 3px rgba(0,0,0,0.06);">' +
        '<img src="' + escapeHtml(logoUrl) + '" alt="' + escapeHtml(s.businessName || 'Noovi.co') +
          ' logo" loading="lazy" style="width:48px;height:48px;border-radius:8px;object-fit:cover;flex:0 0 auto;" />' +
        '<div style="display:flex;flex-direction:column;line-height:1.2;gap:3px;min-width:160px;">' +
          '<div style="font-size:16px;font-weight:700;color:' + cfg.cardTextColor + ';">' +
            escapeHtml(s.businessName || 'Noovi.co') +
          '</div>' +
          '<div style="display:flex;">' + renderStars(s.rating || 0, 17, cfg.accentColor) + '</div>' +
          '<a target="_blank" rel="noreferrer" href="' + escapeHtml(reviewsUrl) + '" ' +
            'style="font-size:13px;color:' + cfg.cardTextColor + ';text-decoration:none;' +
            'transition:color 0.2s;" ' +
            'onmouseover="this.style.color=\'' + cfg.accentColor + '\'" ' +
            'onmouseout="this.style.color=\'' + cfg.cardTextColor + '\'">' +
            '<b>' + (s.userRatingTotal || 0) + ' Google Reviews</b>' +
          '</a>' +
        '</div>' +
      '</div>'

    var writeBtn = cfg.showWriteButton
      ? '<a class="noovi-rev-write-btn" target="_blank" rel="noreferrer" style="display:inline-flex;align-items:center;gap:6px;' +
        'padding:8px 14px;border-radius:8px;background:white;color:' + cfg.cardTextColor +
        ';font-weight:600;text-decoration:none;font-size:14px;border:1px solid rgba(0,0,0,0.08);"' +
        ' href="' + escapeHtml(reviewsUrl) + '">' +
        googleBadgeSvg(18) + '<span>Write a review</span></a>'
      : ''

    // Layout (RTL):
    //   Desktop: [write button LEFT] ... [badge RIGHT]  (space-between)
    //   Mobile:  [badge centered on TOP]
    //            [write button centered BELOW]
    // CSS in injectStyles handles the responsive switch via media query.
    return (
      '<div class="noovi-rev-header">' +
        badge +
        '<div class="noovi-rev-write-wrap">' + writeBtn + '</div>' +
      '</div>'
    )
  }

  function injectStyles(cfg, widgetId) {
    var css =
      '#' + widgetId + '{' +
        'background:' + cfg.widgetBg + ';' +
        'padding:' + (cfg.padding || '24px') + ';' +
        'border-radius:12px;' +
        'direction:' + (cfg.rtl ? 'rtl' : 'ltr') + ';' +
        'font-family:inherit;' +
        'width:100%;' +
        'max-width:100%;' +
        'box-sizing:border-box;' +
        'overflow:hidden;' +
        'position:relative;' +
        // CSS custom properties — used for responsive card sizing
        '--card-w:' + cfg.cardWidth + 'px;' +
        '--card-gap:' + cfg.cardGap + 'px;' +
        '--card-w-mob:' + cfg.cardWidthMobile + 'px;' +
        '--card-gap-mob:' + cfg.cardGapMobile + 'px;' +
      '}' +

      // Header layout:
      //   Desktop (RTL): badge on RIGHT, write button on LEFT (space-between)
      //   Mobile: badge centered on TOP, write button centered BELOW (column)
      '#' + widgetId + ' .noovi-rev-header{' +
        'display:flex;' +
        'align-items:center;' +
        'justify-content:space-between;' +
        'gap:16px;' +
        'flex-wrap:wrap;' +
        'padding:0 0 16px 0;' +
      '}' +
      '#' + widgetId + ' .noovi-rev-write-wrap{' +
        'display:flex;' +
        'align-items:center;' +
      '}' +

      '#' + widgetId + ' .noovi-rev-track{' +
        'display:flex;' +
        // flex-direction:row-reverse puts the FIRST card at the RIGHT edge
        // and subsequent cards extend LEFT. This is what we want for RTL.
        // (direction:rtl on the root handles text alignment within cards;
        // we don't set direction:rtl on the track itself because it doesn't
        // reliably reverse flex item order across browsers.)
        (cfg.rtl ? 'flex-direction:row-reverse;' : '') +
        'gap:var(--card-gap);' +
        'overflow:hidden;' +
        'will-change:transform;' +
        'transition:transform 0.45s ease;' +
        'width:100%;' +
        'box-sizing:border-box;' +
      '}' +
      '#' + widgetId + ' .noovi-rev-card-outer{' +
        // flex-basis is the LARGER of the configured card width OR
        // (container - 2*gap) / 3 — this makes each card GROW to fill
        // the container so exactly 3 cards fit across on desktop.
        // If the container is wider than 3*configuredWidth + 2*gap,
        // cards grow beyond the configured width to fill the space.
        // If narrower, cards stay at the configured width and fewer fit
        // (the carousel handles showing the rest via sliding).
        'flex:0 0 max(var(--card-w), calc((100% - 2 * var(--card-gap)) / 3));' +
        'min-width:0;' +
        'box-sizing:border-box;' +
      '}' +
      '#' + widgetId + ' .noovi-rev-arrow{' +
        'box-shadow:0 1px 4px rgba(0,0,0,0.1);' +
      '}'

    // Mobile breakpoint:
    //   - Smaller padding
    //   - Stack header vertically (badge on top, write button below, both centered)
    //   - Card takes ~85% of container width (room for peek of next card)
    //   - Smaller badge (logo 40px, font 14px)
    css +=
      '@media (max-width:767px){' +
        '#' + widgetId + '{' +
          'padding:' + (cfg.paddingMobile || '12px') + ';' +
        '}' +
        '#' + widgetId + ' .noovi-rev-header{' +
          'flex-direction:column;' +
          'align-items:center;' +
          'justify-content:center;' +
          'gap:12px;' +
        '}' +
        '#' + widgetId + ' .noovi-rev-write-wrap{' +
          'order:2;' + /* below the badge */
        '}' +
        '#' + widgetId + ' .noovi-rev-badge{' +
          'max-width:100% !important;' +
        '}' +
        '#' + widgetId + ' .noovi-rev-badge img{' +
          'width:40px !important;height:40px !important;' +
        '}' +
        '#' + widgetId + ' .noovi-rev-track{' +
          'gap:var(--card-gap-mob);' +
        '}' +
        '#' + widgetId + ' .noovi-rev-card-outer{' +
          'flex:0 0 var(--card-w-mob);' +
          'max-width:calc(100% - 24px);' + /* 1 card + peek of next */
        '}' +
      '}'

    var style = document.createElement('style')
    style.setAttribute('data-noovi-rev', widgetId)
    style.textContent = css
    document.head.appendChild(style)
  }

  function renderWidget(root, payload) {
    var s = payload.shop
    var cfg = s.config
    var reviews = (payload.reviews || []).slice(0, cfg.maxReviews || 50)

    if (!reviews.length) {
      root.innerHTML =
        '<div style="padding:40px;text-align:center;color:' + cfg.cardTextColor +
        ';opacity:0.6;">No reviews yet.</div>'
      return
    }

    var widgetId = 'noovi-rev-' + Math.random().toString(36).slice(2, 9)
    root.id = widgetId

    // Compose desktop + mobile configs in one CSS scope.
    var styleCfg = {
      widgetBg: cfg.widgetBg,
      padding: '24px',
      paddingMobile: '16px',
      cardWidth: cfg.desktopCardWidth,
      cardHeight: cfg.desktopCardHeight,
      cardGap: cfg.desktopCardGap,
      cardWidthMobile: cfg.mobileCardWidth,
      cardHeightMobile: cfg.mobileCardHeight,
      cardGapMobile: cfg.mobileCardGap,
      rtl: cfg.rtl,
    }
    injectStyles(styleCfg, widgetId)

    var header = cfg.showHeader ? buildHeader(payload) : ''

    var cards = ''
    for (var i = 0; i < reviews.length; i++) {
      // We use one card height for both — actual height is min-height,
      // mobile breakpoint is handled by CSS only (we don't need to swap heights
      // mid-render; the min-height is just a floor).
      var cardCfg = Object.assign({}, cfg, {
        cardWidth: cfg.desktopCardWidth,
        cardHeight: cfg.desktopCardHeight,
      })
      cards +=
        '<div class="noovi-rev-card-outer">' + buildCard(reviews[i], cardCfg) + '</div>'
    }

    // Arrows
    var prev =
      '<button type="button" class="noovi-rev-arrow noovi-rev-prev" ' +
      'aria-label="Previous reviews" style="position:absolute;top:50%;transform:translateY(-50%);' +
      (cfg.rtl ? 'right:0;' : 'left:0;') +
      'width:36px;height:36px;border-radius:50%;background:white;border:1px solid rgba(0,0,0,0.08);' +
      'cursor:pointer;display:flex;align-items:center;justify-content:center;color:' +
      cfg.cardTextColor + ';z-index:2;">' +
      '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" ' +
      'stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="' +
      (cfg.rtl ? 'M9 18L15 12L9 6' : 'M15 18L9 12L15 6') + '"/></svg></button>'

    var next =
      '<button type="button" class="noovi-rev-arrow noovi-rev-next" ' +
      'aria-label="Next reviews" style="position:absolute;top:50%;transform:translateY(-50%);' +
      (cfg.rtl ? 'left:0;' : 'right:0;') +
      'width:36px;height:36px;border-radius:50%;background:white;border:1px solid rgba(0,0,0,0.08);' +
      'cursor:pointer;display:flex;align-items:center;justify-content:center;color:' +
      cfg.cardTextColor + ';z-index:2;">' +
      '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" ' +
      'stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="' +
      (cfg.rtl ? 'M15 18L9 12L15 6' : 'M9 18L15 12L9 6') + '"/></svg></button>'

    root.innerHTML =
      header +
      '<div style="position:relative;">' +
        prev + next +
        '<div class="noovi-rev-track">' + cards + '</div>' +
      '</div>'

    // Carousel logic — track current index, slide by visible count.
    var track = root.querySelector('.noovi-rev-track')
    var prevBtn = root.querySelector('.noovi-rev-prev')
    var nextBtn = root.querySelector('.noovi-rev-next')
    var currentIndex = 0

    // Measure the ACTUAL rendered card width (including gap) from the DOM.
    // The CSS max-width constraint may shrink cards to fit the container
    // (e.g. 3 across on desktop regardless of container width), so we can't
    // use the config value directly.
    function actualCardPlusGap() {
      var firstCard = track.querySelector('.noovi-rev-card-outer')
      if (!firstCard) return cfg.desktopCardWidth + cfg.desktopCardGap
      var cardW = firstCard.getBoundingClientRect().width
      var gap = parseFloat(getComputedStyle(track).gap) || 0
      return cardW + gap
    }

    function visibleCount() {
      var trackWidth = track.clientWidth
      var cw = actualCardPlusGap()
      if (cw <= 0) return 1
      // floor(trackWidth / (cardWidth + gap)) gives the number of full cards
      // that fit. Adding the gap back to trackWidth accounts for the gap
      // after the last visible card not being needed.
      return Math.max(1, Math.floor((trackWidth + (cw - firstCardWidth())) / cw))
    }

    function firstCardWidth() {
      var firstCard = track.querySelector('.noovi-rev-card-outer')
      if (!firstCard) return cfg.desktopCardWidth
      return firstCard.getBoundingClientRect().width
    }

    function maxIndex() {
      var v = visibleCount()
      return Math.max(0, reviews.length - v)
    }

    function slideTo(i) {
      var max = maxIndex()
      currentIndex = Math.max(0, Math.min(i, max))
      var cw = actualCardPlusGap()
      // With flex-direction:row-reverse (RTL), card 0 is at the RIGHT edge
      // and subsequent cards extend LEFT (overflow to the left, clipped by
      // overflow:hidden). To reveal later cards (higher index), shift the
      // track LEFT => negative translate. This is the SAME direction as LTR.
      // (Previously we used positive translate for RTL, which was wrong with
      // row-reverse — it shifted cards further right, off-screen.)
      var translate = -currentIndex * cw
      track.style.transform = 'translateX(' + translate + 'px)'
    }

    prevBtn.addEventListener('click', function () {
      slideTo(currentIndex - visibleCount())
    })
    nextBtn.addEventListener('click', function () {
      slideTo(currentIndex + visibleCount())
    })
    window.addEventListener('resize', function () {
      slideTo(currentIndex)
    })

    slideTo(0)

    // Autoplay — slides ONE card at a time every N seconds (per config).
    // Continues until the last review is shown, then resets to the start.
    // Pause on hover, resume on mouseleave.
    if (cfg.autoplay) {
      var autoplayTick = function () {
        var max = maxIndex()
        if (currentIndex >= max) {
          slideTo(0)
        } else {
          slideTo(currentIndex + 1)
        }
      }
      var interval = setInterval(autoplayTick, cfg.autoplaySpeed || 5000)

      root.addEventListener('mouseenter', function () {
        clearInterval(interval)
      })
      root.addEventListener('mouseleave', function () {
        clearInterval(interval)
        interval = setInterval(autoplayTick, cfg.autoplaySpeed || 5000)
      })
    }
  }

  function init() {
    var shop = qs('shop')
    if (!shop) {
      console.warn('[noovi-reviews] embed.js missing ?shop= param')
      return
    }
    var root = document.getElementById('noovi-reviews-root')
    if (!root) {
      console.warn('[noovi-reviews] #noovi-reviews-root not found in the page')
      return
    }
    var origin = getOrigin()
    if (!origin) {
      console.warn('[noovi-reviews] could not resolve app origin from embed.js src')
      return
    }
    var api = origin + '/api/reviews/public?shop=' + encodeURIComponent(shop)

    function load() {
      fetch(api, { credentials: 'omit' })
        .then(function (r) {
          if (!r.ok) throw new Error('HTTP ' + r.status)
          return r.json()
        })
        .then(function (payload) {
          renderWidget(root, payload)
        })
        .catch(function (e) {
          console.warn('[noovi-reviews] failed to load reviews:', e)
        })
    }

    // Defer loading by 3 seconds after the page's load event fires.
    // This lets the browser paint the page and run critical scripts first,
    // improving Lighthouse / Core Web Vitals scores. The reviews widget is
    // below-the-fold content that doesn't need to block initial render.
    var DELAY_MS = 3000

    function scheduleLoad() {
      setTimeout(load, DELAY_MS)
    }

    if (document.readyState === 'complete') {
      // Page already loaded (e.g. script loaded late via async) — schedule now
      scheduleLoad()
    } else {
      // Wait for the page's load event, then schedule the deferred load
      window.addEventListener('load', scheduleLoad)
    }

    // Refresh every 5 minutes so a daily refresh is reflected without reload.
    setInterval(load, 5 * 60 * 1000)
  }

  init()
})()
