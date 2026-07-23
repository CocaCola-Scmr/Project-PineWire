"""Hostname labels and noise filters used by capture_poc.py."""

# Domains commonly used for background telemetry, analytics, logging, app
# "heartbeat" traffic, ad networks, CDN/asset infrastructure, or OS-level
# plumbing (connectivity checks, software update, push notification
# transport) - things a device or app does automatically, rather than the
# actual site/content a user was looking at. Matched as a substring, so a
# keyword like "sentry.io" catches any subdomain of it too.

# This stays intentionally broad. Apps and sites still rely on lots of shared
# analytics, CDN and SDK hostnames, so the list will never be perfect.


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
    # Mobile app SDKs for attribution/analytics/social login.
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
    # Common third-party SDK and analytics providers.
    "sentry.io", "bugsnag", "statsig", "splunkcloud", "datadoghq",
    "newrelic", "amplitude", "mixpanel", "segment.io", "segment.com",
    "launchdarkly", "onesignal", "pusher.com", "airship.com",
    "urbanairship", "branch.io", "adjust.com", "kochava", "instabug",
    "mapbox", "hockeyapp", "flurry.com", "optimizely", "fullstory",
    "hotjar", "intercom.io", "braze.com", "iterable.com", "clevertap.com",
    "leanplum.com",

    # OS/platform background plumbing (Android, iOS/macOS, Windows).

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

    # Windows Mobile Hotspot suffix. Bare hostnames get retried as
    # "<hostname>.mshome.net", which is just a duplicate lookup.
    "mshome.net",

    # Ad-tech / marketing / analytics trackers.
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
    "yahoo.com": "Yahoo", "yandex.com": "Yandex",
    "ecosia.org": "Ecosia", "brave.com": "Brave Search",
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
    "threads.net": "Threads", "threads.com": "Threads",
    "beacons.ai": "Creator tools", "linktr.ee": "Linktree",
    # Messaging
    "whatsapp.net": "WhatsApp", "whatsapp.com": "WhatsApp",
    "telegram.org": "Telegram", "t.me": "Telegram", "signal.org": "Signal",
    "wechat.com": "WeChat", "weixin.qq.com": "WeChat", "line.me": "LINE",
    "viber.com": "Viber", "kik.com": "Kik", "messenger.com": "Messenger",
    "skype.com": "Skype",
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
    "primevideo.com": "Prime Video", "amazonvideo.com": "Prime Video",
    "tubitv.com": "Tubi", "pluto.tv": "Pluto TV", "plex.tv": "Plex",
    "vimeo.com": "Vimeo", "dailymotion.com": "Dailymotion",
    "crunchyroll.com": "Crunchyroll", "hbomax.com": "Max",
    "max.com": "Max", "bbc.co.uk": "BBC", "abc.net.au": "ABC News",
    # Shopping
    "amazon.com": "Amazon", "amazon.com.au": "Amazon",
    "ssl-images-amazon.com": "Amazon", "media-amazon.com": "Amazon",
    "ebay.com": "eBay", "ebaystatic.com": "eBay", "etsy.com": "Etsy",
    "aliexpress.com": "AliExpress", "walmart.com": "Walmart",
    "target.com": "Target", "bestbuy.com": "Best Buy",
    "woolworths.com.au": "Woolworths", "coles.com.au": "Coles",
    "kmart.com.au": "Kmart", "bunnings.com.au": "Bunnings",
    "jbhifi.com.au": "JB Hi-Fi", "officeworks.com.au": "Officeworks",
    "myer.com.au": "Myer", "davidjones.com": "David Jones",
    "bigw.com.au": "BIG W", "theiconic.com.au": "THE ICONIC",
    "catch.com.au": "Catch", "aldi.com.au": "ALDI", "ikea.com.au": "IKEA",
    "kogan.com": "Kogan", "temu.com": "Temu", "shein.com": "SHEIN",
    "costco.com.au": "Costco", "kmart.co.nz": "Kmart",
    # Finance
    "paypal.com": "PayPal", "venmo.com": "Venmo", "cash.app": "Cash App",
    "commbank.com.au": "CommBank", "nab.com.au": "NAB", "anz.com": "ANZ",
    "westpac.com.au": "Westpac", "up.com.au": "Up Bank",
    "afterpay.com": "Afterpay", "zip.co": "Zip",
    "macquarie.com.au": "Macquarie", "bankwest.com.au": "Bankwest",
    "stgeorge.com.au": "St.George", "boq.com.au": "Bank of Queensland",
    "ing.com.au": "ING", "bendigobank.com.au": "Bendigo Bank",
    "raiz.com.au": "Raiz", "wise.com": "Wise", "revolut.com": "Revolut",
    "commsec.com.au": "CommSec", "stake.com": "Stake", "coinbase.com": "Coinbase",
    "crypto.com": "Crypto.com", "robinhood.com": "Robinhood",
    # Maps / navigation
    "waze.com": "Waze", "here.com": "HERE Maps", "garmin.com": "Garmin",
    "maps.apple.com": "Apple Maps", "mapquest.com": "MapQuest",
    "maps.google.com": "Google Maps", "google.com/maps": "Google Maps",
    "openstreetmap.org": "OpenStreetMap",
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
    "surveymonkey.com": "SurveyMonkey", "typeform.com": "Typeform",
    "miro.com": "Miro", "lucid.app": "Lucid", "todoist.com": "Todoist",
    "calendar.google.com": "Google Calendar", "meet.google.com": "Google Meet",
    "docs.google.com": "Google Docs", "sheets.google.com": "Google Sheets",
    "slides.google.com": "Google Slides", "drive.google.com": "Google Drive",
    "mail.google.com": "Gmail", "one.google.com": "Google One",
    "teams.microsoft.com": "Microsoft Teams", "officeapps.live.com": "Microsoft Office",
    "onedrive.live.com": "OneDrive", "onenote.com": "OneNote",
    "outlook.com": "Outlook", "outlook.office.com": "Outlook",
    "sharepoint.com": "SharePoint", "confluence.com": "Confluence",
    "atlassian.net": "Atlassian",
    # Dev/tech
    "github.com": "GitHub", "gitlab.com": "GitLab", "bitbucket.org": "Bitbucket",
    "stackoverflow.com": "Stack Overflow", "openai.com": "ChatGPT",
    "chatgpt.com": "ChatGPT", "claude.ai": "Claude", "claude.com": "Claude",
    "anthropic.com": "Claude", "npmjs.com": "npm",
    "developer.android.com": "Android Developers", "developer.apple.com": "Apple Developer",
    "mozilla.org": "Mozilla", "docker.com": "Docker", "kubernetes.io": "Kubernetes",
    "python.org": "Python", "openjdk.org": "OpenJDK", "rust-lang.org": "Rust",
    "golang.org": "Go", "nodejs.org": "Node.js",
    # Email
    "protonmail.com": "Proton Mail", "proton.me": "Proton Mail",
    "mail.yahoo.com": "Yahoo Mail", "mail.google.com": "Gmail",
    "outlook.live.com": "Outlook",
    # Gaming
    "steampowered.com": "Steam", "steamcontent.com": "Steam",
    "steamstatic.com": "Steam", "epicgames.com": "Epic Games",
    "playstation.com": "PlayStation", "sony.com": "PlayStation",
    "xbox.com": "Xbox", "xboxlive.com": "Xbox", "nintendo.com": "Nintendo",
    "roblox.com": "Roblox", "minecraft.net": "Minecraft", "ea.com": "EA",
    "riotgames.com": "Riot Games", "leagueoflegends.com": "League of Legends",
    "battle.net": "Battle.net", "blizzard.com": "Blizzard",
    "twitch.tv": "Twitch", "gog.com": "GOG", "ubisoft.com": "Ubisoft",
    "play.google.com": "Google Play",
    # Travel / delivery / rideshare
    "uber.com": "Uber", "ubereats.com": "Uber Eats", "lyft.com": "Lyft",
    "doordash.com": "DoorDash", "menulog.com.au": "Menulog",
    "deliveroo.com": "Deliveroo", "airbnb.com": "Airbnb",
    "booking.com": "Booking.com", "tripadvisor.com": "TripAdvisor",
    "expedia.com": "Expedia", "qantas.com": "Qantas",
    "jetstar.com": "Jetstar", "virginaustralia.com": "Virgin Australia",
    "skyscanner.com.au": "Skyscanner", "trip.com": "Trip.com",
    "rome2rio.com": "Rome2Rio", "redballoon.com.au": "RedBalloon",
    "tripit.com": "TripIt", "airasia.com": "AirAsia",
    # Health / fitness
    "strava.com": "Strava", "fitbit.com": "Fitbit",
    "myfitnesspal.com": "MyFitnessPal", "headspace.com": "Headspace",
    "calm.com": "Calm", "whoop.com": "WHOOP", "nike.com": "Nike",
    "apple.com": "Apple services", "healthifyme.com": "HealthifyMe",
    # Education
    "duolingo.com": "Duolingo", "coursera.org": "Coursera",
    "khanacademy.org": "Khan Academy", "udemy.com": "Udemy",
    "openlearning.com": "OpenLearning", "studentvip.com.au": "StudentVIP",
    "canvas.instructure.com": "Canvas", "moodle.org": "Moodle",
    "moodle.com": "Moodle", "blackboard.com": "Blackboard",
    "edx.org": "edX", "futurelearn.com": "FutureLearn",
    "unsw.edu.au": "UNSW", "student.unsw.edu.au": "UNSW",
    "microsoft365.com": "Microsoft 365",
    # Dating
    "tinder.com": "Tinder", "bumble.com": "Bumble", "hinge.co": "Hinge",
    "okcupid.com": "OkCupid", "grindr.com": "Grindr",
    # Jobs / real estate
    "indeed.com": "Indeed", "seek.com.au": "Seek",
    "realestate.com.au": "realestate.com.au", "domain.com.au": "Domain",
    "jora.com": "Jora", "zippia.com": "Zippia", "linkedin.com/jobs": "LinkedIn Jobs",
    # News / weather (AU-relevant)
    "abc.net.au": "ABC News", "news.com.au": "news.com.au",
    "sbs.com.au": "SBS", "nine.com.au": "Nine", "7plus.com.au": "7plus",
    "10play.com.au": "10 play", "smh.com.au": "Sydney Morning Herald",
    "theage.com.au": "The Age", "afr.com": "Australian Financial Review",
    "couriermail.com.au": "Courier-Mail", "dailytelegraph.com.au": "Daily Telegraph",
    "bom.gov.au": "Bureau of Meteorology", "weather.com": "Weather.com",
    "bbc.com": "BBC", "cnn.com": "CNN", "reuters.com": "Reuters",
    "apnews.com": "AP News", "theguardian.com": "The Guardian",
    "nytimes.com": "The New York Times", "washingtonpost.com": "The Washington Post",
    # Phones/OS vendors' own app stores and services (recognisable "app"
    # activity, distinct from the OS background noise filtered out above)
    "samsungapps.com": "Samsung Galaxy Store",
    "apple.com": "Apple services", "icloud.com": "iCloud", "itunes.com": "Apple services",
    "microsoft.com": "Microsoft services",
    # Australia / local telco and utility brands
    "telstra.com": "Telstra", "optus.com.au": "Optus",
    "vodafone.com.au": "Vodafone Australia", "amaysim.com.au": "amaysim",
    "boostmobile.com.au": "Boost Mobile", "tpg.com.au": "TPG",
    "iinet.net.au": "iiNet", "aussiebroadband.com.au": "Aussie Broadband",
    "superloop.com": "Superloop", "launtel.net.au": "Launtel",
    "felixmobile.com.au": "felix mobile", "belong.com.au": "Belong",
    "dodo.com": "Dodo", "spintel.net.au": "SpinTel",
    "energyaustralia.com.au": "EnergyAustralia", "agl.com.au": "AGL",
    "originenergy.com.au": "Origin Energy",
    "service.nsw.gov.au": "Service NSW", "my.gov.au": "myGov",
    "servicesaustralia.gov.au": "Services Australia",
}
ORG_DEDUP_WINDOW_SECONDS = 20
