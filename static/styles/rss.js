/*
  Renders the RSS feed as a human-readable page in browsers, replacing the
  former XSLT stylesheet (browsers are dropping XSLT support). Feed readers
  ignore the <script> element and keep reading the plain RSS.

  Based on Pretty Feed (https://github.com/genmon/aboutfeeds) and
  https://jakearchibald.com/2025/making-xml-human-readable-without-xslt/
*/
const renderFeed = () => {
  const feed = document.documentElement;
  const channel = feed.querySelector('channel');
  if (!channel) return;

  const text = (parent, selector) =>
    parent.querySelector(`:scope > ${selector}`)?.textContent.trim() ?? '';

  // Parse the page as HTML so every element ends up in the XHTML namespace.
  const page = new DOMParser().parseFromString(
    `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
    <link rel="stylesheet" href="/styles/rss.css">
  </head>
  <body class="bg-white">
    <nav class="container-md px-3 py-2 mt-2 mt-md-5 mb-5 markdown-body">
      <p class="bg-yellow-light ml-n1 px-1 py-1 mb-1">
        <strong>This is a web feed,</strong> also known as an RSS feed. <strong>Subscribe</strong> by copying the URL from the address bar into your newsreader.
      </p>
      <p class="text-gray">
        Visit <a href="https://aboutfeeds.com">About Feeds</a> to get started with newsreaders and subscribing. It’s free.
      </p>
    </nav>
    <div class="container-md px-3 py-3 markdown-body">
      <header class="py-5">
        <h1 class="border-0">
          <!-- https://commons.wikimedia.org/wiki/File:Feed-icon.svg -->
          <svg xmlns="http://www.w3.org/2000/svg" version="1.1" style="vertical-align: text-bottom; width: 1.2em; height: 1.2em;" class="pr-1" id="RSSicon" viewBox="0 0 256 256">
            <defs>
              <linearGradient x1="0.085" y1="0.085" x2="0.915" y2="0.915" id="RSSg">
                <stop offset="0.0" stop-color="#E3702D"/><stop offset="0.1071" stop-color="#EA7D31"/>
                <stop offset="0.3503" stop-color="#F69537"/><stop offset="0.5" stop-color="#FB9E3A"/>
                <stop offset="0.7016" stop-color="#EA7C31"/><stop offset="0.8866" stop-color="#DE642B"/>
                <stop offset="1.0" stop-color="#D95B29"/>
              </linearGradient>
            </defs>
            <rect width="256" height="256" rx="55" ry="55" x="0" y="0" fill="#CC5D15"/>
            <rect width="246" height="246" rx="50" ry="50" x="5" y="5" fill="#F49C52"/>
            <rect width="236" height="236" rx="47" ry="47" x="10" y="10" fill="url(#RSSg)"/>
            <circle cx="68" cy="189" r="24" fill="#FFF"/>
            <path d="M160 213h-34a82 82 0 0 0 -82 -82v-34a116 116 0 0 1 116 116z" fill="#FFF"/>
            <path d="M184 213A140 140 0 0 0 44 73 V 38a175 175 0 0 1 175 175z" fill="#FFF"/>
          </svg>
          Web Feed Preview
        </h1>
        <h2 data-channel-title></h2>
        <p data-channel-description></p>
        <a class="head_link" target="_blank" data-channel-link>Visit Website &#x2192;</a>
      </header>
      <h2>Recent Items</h2>
      <div data-items></div>
    </div>
  </body>
</html>`,
    'text/html',
  );

  const title = text(channel, 'title');
  page.title = `${title} Web Feed`;
  page.querySelector('[data-channel-title]').textContent = title;
  page.querySelector('[data-channel-description]').textContent = text(channel, 'description');
  page.querySelector('[data-channel-link]').href = text(channel, 'link');

  const list = page.querySelector('[data-items]');
  for (const item of channel.querySelectorAll(':scope > item')) {
    const entry = page.createElement('div');
    entry.className = 'pb-5';

    const heading = page.createElement('h3');
    heading.className = 'mb-0';
    const link = page.createElement('a');
    link.target = '_blank';
    link.href = text(item, 'link');
    link.textContent = text(item, 'title');
    heading.append(link);

    const date = page.createElement('small');
    date.className = 'text-gray';
    date.textContent = `Published: ${text(item, 'pubDate')}`;

    entry.append(heading, date);
    list.append(entry);
  }
  list.replaceWith(...list.childNodes);

  feed.replaceWith(document.importNode(page.documentElement, true));
};

// Browsers ignore `defer` in XML documents, so wait until the whole feed is parsed.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', renderFeed, { once: true });
} else {
  renderFeed();
}
