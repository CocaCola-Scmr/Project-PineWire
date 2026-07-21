"""
Reference data for capture_poc.py: which hostnames are background "noise"
(telemetry/ads/SDKs/OS plumbing), and which known consumer apps/services a
recognised hostname belongs to.

This is a fixed, deterministic lookup - it can only recognise domains
explicitly listed here. It will never be complete (see the note at the top
of NOISE_KEYWORDS in capture_poc.py for why), but it's been made as wide as
practical so that most common everyday apps get a friendly label instead of
showing up as a wall of unfamiliar subdomains. Kept in its own file since
it's just data, not filtering logic, and it's easiest to keep extending as
one big list rather than mixed in with the capture/parsing code.
"""

# Domains commonly used for background telemetry, analytics, logging, app
# "heartbeat" traffic, ad networks, CDN/asset infrastructure, or OS-level
# plumbing (connectivity checks, software update, push notification
# transport) - things a device or app does automatically, rather than the
# actual site/content a user was looking at. Matched as a substring, so a
# keyword like "sentry.io" catches any subdomain of it too.

# IMPORTANT LIMITATION: every app bundles its own mix of analytics/SDK
# infrastructure (e.g. opening Reddit alone touched gql-fed.reddit.com,
# w3-reporting.reddit.com, matrix.redditspace.com, graph.facebook.com, and
# two different appsflyersdk.com subdomains - none of which the user
# actually chose to visit). There is no way to hardcode a list that covers
# every app's SDKs in advance - this is the exact same whack-a-mole problem
# real ad/tracker blocklists (e.g. EasyList/EasyPrivacy) face, and why those
# lists are maintained by large communities and updated constantly, and
# still don't catch everything. The actual data lives in common_services.py
# (kept separate since it's just a big data table, not filtering logic) and
# has been made as wide as practical, but it will never be complete.


NOISE_KEYWORDS = (
    # Generic analytics/telemetry/crash-reporting terms
    "log", "telemetry", "analytics", "metrics", "crashlytics", "diagnostic",
    "events.data", "app-measurement", "rudderstack", "signalr", "beacon",
    "collector", "reporting",
    # CDN / static asset hosting - supporting infrastructure, not content
    "gstatic", "googleusercontent", "googleapis",
    # Ad networks and ad-adjacent services
    "googleadservices", "doubleclick", "ampproject",
    # Automatic safety/config checks, not something a user asked for
    "safebrowsing",
    # Background app syncs/telemetry unrelated to what the user is doing
    "appcenter.ms", "microsoftapp.net", "aria.microsoft", "edge.microsoft",
    "edge.skype", "config.office", "graph.microsoft.com",
    # Mobile app SDKs for attribution/analytics/social login - embedded in
    # a huge number of unrelated apps, not something a user directly uses
    "graph.facebook.com", "appsflyersdk", "onelink.me",
    # Generic backend/API naming patterns (GraphQL federation, realtime
    # gateways, CDN config) - technical infrastructure jargon that real
    # human-facing content domains don't tend to use as a subdomain
    "gql-", "cdn-settings",
    # In-app payment/subscription/paywall SDKs - backend calls an app makes
    # to check billing status, not a site the user visited
    "razorpay", "revenuecat", "pawwalls", "stripe.com",
    # Microsoft device/enterprise management background checks
    "enterpriseregistration", "mobileappcommunicator",
    # Misc background messaging/test infrastructure seen during testing
    "edge-mqtt", "test-gateway", "newchatapi",
    # Widely-used third-party crash reporting / analytics / feature-flag /
    # attribution / push-notification SDKs, embedded across countless
    # unrelated apps - none of this is "an app the user opened"
    "sentry.io", "bugsnag", "statsig", "splunkcloud", "datadoghq",
    "newrelic", "amplitude", "mixpanel", "segment.io", "segment.com",
    "launchdarkly", "onesignal", "pusher.com", "airship.com",
    "urbanairship", "branch.io", "adjust.com", "kochava", "instabug",
    "mapbox", "hockeyapp", "flurry.com", "optimizely", "fullstory",
    "hotjar", "intercom.io", "braze.com", "iterable.com", "clevertap.com",
    "leanplum.com",

    # --- OS/platform background plumbing (Android, iOS/macOS, Windows) ---
    # None of this is "an app the user opened" - it's the operating system
    # itself checking for internet, updates, push notifications, or time
    # sync, which happens constantly and automatically on every device.

    # Android / Google Play services background checks
    "connectivitycheck", "clients3.google.com", "clients4.google.com",
    "android.clients.google.com", "mtalk.google.com", "update.googleapis.com",
    "play-fe.googleapis.com", "gstaticadssl", "gvt1.com", "gvt2.com",
    "dl.google.com",

    # Apple (iOS/macOS/iPadOS) background checks - captive portal, push
    # notifications, certificate validation, time sync, software update
    "captive.apple.com", "push.apple.com", "gsp-ssl.ls.apple.com",
    "gsp64-ssl.ls.apple.com", "time.apple.com", "time-ios.apple.com",
    "gdmf.apple.com", "mesu.apple.com", "swscan.apple.com",
    "swcdn.apple.com", "ocsp.apple.com", "crl.apple.com",
    "configuration.apple.com", "init.itunes.apple.com", "itunes.apple.com",
    "lcdn-locator.apple.com", "albert.apple.com", "gs.apple.com",
    "lookup-api.apple.com",

    # Windows background checks - connectivity test, updates, telemetry,
    # push notifications (WNS), Delivery Optimization, Store background
    "msftconnecttest.com", "msftncsi.com", "windowsupdate.microsoft.com",
    "download.windowsupdate.com", "sls.update.microsoft.com",
    "fe2.update.microsoft.com", "delivery.mp.microsoft.com",
    "vortex-win.data.microsoft.com", "settings-win.data.microsoft.com",
    "data.microsoft.com", "oneclient.sfx.ms", "displaycatalog.mp.microsoft.com",
    "storeedgefd.dsx.mp.microsoft.com", "notify.windows.com",
    "wns.windows.com", "ctldl.windowsupdate.com",

    # Windows Mobile Hotspot's internal DNS suffix. When a connected device
    # looks up a bare/short hostname, Windows' DNS suffix search list will
    # also silently retry it as "<hostname>.mshome.net" - this produces an
    # exact duplicate of every single lookup, not a second real site, so it
    # is always noise regardless of what precedes it.
    "mshome.net",

    # --- Ad-tech / marketing-attribution / UX-analytics trackers ---
    # An enormous share of commercial websites (B2B SaaS sites and review
    # sites like G2/TechTarget especially) embed dozens of third-party
    # real-time-bidding ad exchanges, identity-resolution, and marketing
    # analytics vendors on every single page load. None of these are a
    # site the user chose to visit - they are invisible passengers on
    # whatever page was actually loaded. This list covers the major,
    # well-known vendors in this industry (the same domains a browser
    # tracker blocklist like EasyPrivacy would also block).
    "adsrvr.org", "bidswitch.net", "casalemedia.com", "rubiconproject.com",
    "openx.net", "3lift.com", "pubmatic.com", "rlcdn.com", "adnxs.com",
    "agkn.com", "tapad.com", "eyeota.net", "smartadserver.com", "adroll.com",
    "contentsquare.net", "contentsquare.com", "6sense.com", "6sc.co",
    "qualified.com", "marketo.net", "marketlinc.com", "ml-attr.com",
    "ml314.com", "criteo.com", "taboola.com", "outbrain.com",
    "quantserve.com", "scorecardresearch.com", "adform.net", "media.net",
    "yieldmo.com", "sharethrough.com", "indexexchange.com",
    "spotxchange.com", "smaato.net", "inmobi.com", "mopub.com",
    "chartboost.com", "vungle.com", "bluekai.com", "demandbase.com",
    "zoominfo.com", "leadfeeder.com", "bidr.io", "adsymptotic.com",
    "bombora.com", "mathtag.com", "trk.techtarget.com", "ibc-flow.techtarget.com",
)


# Maps a hostname suffix to a short, friendly "organisation" label. Many
# apps spread their traffic across dozens of different subdomains (Reddit
# alone used reddit.com, redd.it, redditmedia.com, and redditspace.com), so
# grouping by organisation instead of showing every raw subdomain cuts an
# enormous amount of repetition. Matching is suffix-based (any subdomain,
# no matter how deep, counts), so adding one entry per company/app covers
# all of its subdomains automatically.
ORGANISATION_LABELS = {
    # Search / general web
    "google.com": "Google", "google.com.au": "Google",
    "bing.com": "Bing", "duckduckgo.com": "DuckDuckGo",
    "yahoo.com": "Yahoo",
    # Social media
    "reddit.com": "Reddit", "redd.it": "Reddit", "redditmedia.com": "Reddit",
    "redditspace.com": "Reddit", "redditstatic.com": "Reddit",
    "instagram.com": "Instagram", "fbcdn.net": "Instagram/Facebook",
    "facebook.com": "Instagram/Facebook", "messenger.com": "Messenger",
    "twitter.com": "Twitter/X", "x.com": "Twitter/X", "twimg.com": "Twitter/X",
    "t.co": "Twitter/X",
    "tiktok.com": "TikTok", "tiktokv.com": "TikTok", "musical.ly": "TikTok",
    "snapchat.com": "Snapchat", "sc-cdn.net": "Snapchat",
    "linkedin.com": "LinkedIn", "licdn.com": "LinkedIn",
    "pinterest.com": "Pinterest", "pinimg.com": "Pinterest",
    "discord.com": "Discord", "discordapp.com": "Discord",
    "discordapp.net": "Discord", "tumblr.com": "Tumblr", "quora.com": "Quora",
    # Messaging
    "whatsapp.net": "WhatsApp", "whatsapp.com": "WhatsApp",
    "telegram.org": "Telegram", "t.me": "Telegram", "signal.org": "Signal",
    "wechat.com": "WeChat", "weixin.qq.com": "WeChat", "line.me": "LINE",
    "viber.com": "Viber", "kik.com": "Kik",
    # Streaming / media
    "youtube.com": "YouTube", "googlevideo.com": "YouTube", "ytimg.com": "YouTube",
    "netflix.com": "Netflix", "nflxvideo.net": "Netflix",
    "nflximg.net": "Netflix", "nflxso.net": "Netflix",
    "spotify.com": "Spotify", "scdn.co": "Spotify",
    "twitch.tv": "Twitch", "ttvnw.net": "Twitch",
    "disneyplus.com": "Disney+", "bamgrid.com": "Disney+",
    "soundcloud.com": "SoundCloud", "deezer.com": "Deezer", "hulu.com": "Hulu",
    "stan.com.au": "Stan", "binge.com.au": "Binge",
    "paramountplus.com": "Paramount+",
    # Shopping
    "amazon.com": "Amazon", "amazon.com.au": "Amazon",
    "ssl-images-amazon.com": "Amazon", "media-amazon.com": "Amazon",
    "ebay.com": "eBay", "ebaystatic.com": "eBay", "etsy.com": "Etsy",
    "aliexpress.com": "AliExpress", "walmart.com": "Walmart",
    "target.com": "Target", "bestbuy.com": "Best Buy",
    "woolworths.com.au": "Woolworths", "coles.com.au": "Coles",
    "kmart.com.au": "Kmart", "bunnings.com.au": "Bunnings",
    "jbhifi.com.au": "JB Hi-Fi", "officeworks.com.au": "Officeworks",
    # Finance
    "paypal.com": "PayPal", "venmo.com": "Venmo", "cash.app": "Cash App",
    "commbank.com.au": "CommBank", "nab.com.au": "NAB", "anz.com": "ANZ",
    "westpac.com.au": "Westpac", "up.com.au": "Up Bank",
    "afterpay.com": "Afterpay", "zip.co": "Zip",
    # Maps / navigation
    "waze.com": "Waze", "here.com": "HERE Maps", "garmin.com": "Garmin",
    # Productivity / work
    "notion.so": "Notion", "notion.com": "Notion",
    "slack.com": "Slack", "slack-edge.com": "Slack",
    "office.com": "Microsoft Outlook/Office",
    "office365.com": "Microsoft Outlook/Office",
    "zoom.us": "Zoom", "trello.com": "Trello", "asana.com": "Asana",
    "monday.com": "Monday.com", "airtable.com": "Airtable",
    "dropbox.com": "Dropbox", "box.com": "Box", "evernote.com": "Evernote",
    "canva.com": "Canva", "figma.com": "Figma", "adobe.com": "Adobe",
    "grammarly.com": "Grammarly", "webex.com": "Webex",
    # Dev/tech
    "github.com": "GitHub", "gitlab.com": "GitLab", "bitbucket.org": "Bitbucket",
    "stackoverflow.com": "Stack Overflow", "openai.com": "ChatGPT",
    "chatgpt.com": "ChatGPT", "claude.ai": "Claude", "claude.com": "Claude",
    "anthropic.com": "Claude", "npmjs.com": "npm",
    # Email
    "protonmail.com": "Proton Mail", "proton.me": "Proton Mail",
    # Gaming
    "steampowered.com": "Steam", "steamcontent.com": "Steam",
    "steamstatic.com": "Steam", "epicgames.com": "Epic Games",
    "playstation.com": "PlayStation", "sony.com": "PlayStation",
    "xbox.com": "Xbox", "xboxlive.com": "Xbox", "nintendo.com": "Nintendo",
    "roblox.com": "Roblox", "minecraft.net": "Minecraft", "ea.com": "EA",
    "riotgames.com": "Riot Games", "leagueoflegends.com": "League of Legends",
    # Travel / delivery / rideshare
    "uber.com": "Uber", "ubereats.com": "Uber Eats", "lyft.com": "Lyft",
    "doordash.com": "DoorDash", "menulog.com.au": "Menulog",
    "deliveroo.com": "Deliveroo", "airbnb.com": "Airbnb",
    "booking.com": "Booking.com", "tripadvisor.com": "TripAdvisor",
    "expedia.com": "Expedia", "qantas.com": "Qantas",
    "jetstar.com": "Jetstar", "virginaustralia.com": "Virgin Australia",
    # Health / fitness
    "strava.com": "Strava", "fitbit.com": "Fitbit",
    "myfitnesspal.com": "MyFitnessPal", "headspace.com": "Headspace",
    "calm.com": "Calm",
    # Education
    "duolingo.com": "Duolingo", "coursera.org": "Coursera",
    "khanacademy.org": "Khan Academy", "udemy.com": "Udemy",
    # Dating
    "tinder.com": "Tinder", "bumble.com": "Bumble", "hinge.co": "Hinge",
    "okcupid.com": "OkCupid", "grindr.com": "Grindr",
    # Jobs / real estate
    "indeed.com": "Indeed", "seek.com.au": "Seek",
    "realestate.com.au": "realestate.com.au", "domain.com.au": "Domain",
    # News / weather (AU-relevant)
    "abc.net.au": "ABC News", "news.com.au": "news.com.au",
    "bom.gov.au": "Bureau of Meteorology", "weather.com": "Weather.com",
    # Phones/OS vendors' own app stores and services (recognisable "app"
    # activity, distinct from the OS background noise filtered out above)
    "samsungapps.com": "Samsung Galaxy Store",
    "apple.com": "Apple services", "icloud.com": "iCloud",
    "microsoft.com": "Microsoft services",
}
ORG_DEDUP_WINDOW_SECONDS = 20
