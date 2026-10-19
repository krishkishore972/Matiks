# Matiks — UI inventory (from the shipped Android artifact)

Evidence base: `com.matiks.app` 1.51.0 XAPK, Hermes bundle string table
(193,292 strings extracted with `hermes-dec` 0.1.8 / HBC v98) plus the decoded
AndroidManifest and launcher assets. Every claim below is a string key or a
literal copy string from that table unless marked **inferred**.

> The bundle contains i18n **keys** and the English **copy values** in one flat
> table with no key→value pairing, plus developer-written **description**
> strings (e.g. `"Home navigator item title for leaderboard"`). Descriptions are
> excellent semantic evidence but are never shown to users.

## 1. Navigation model

React Navigation with four coexisting shells:

- **Bottom tab navigator** — `BottomTabNavigator`, `createBottomTabNavigator`,
  `BottomTabBar`, `BottomTabItem`, `TabBarIcon`.
- **Root native stack** — `RootNavigator`, `createNativeStackNavigator`;
  327 `*Screen` and 64 `*Route` identifiers exist.
- **Drawer / expanded left pane** — `LeftPaneNavigator`,
  `ExpandedScreenLeftPaneNavigator`, `MobileDrawerScreen`.
- **Home navigator** — `HomeScreen`, `getHomeNavigatorTabs`.

Bottom-tab labels (three overlapping i18n sources, which disagree — the app
feature-flags its nav):

| source | tabs |
|---|---|
| `bottomNavBar.tab.*` | arena, compete, dailies, feed, jelo, menu, more, quests, snac |
| `tabs.title.*` | arena, compete, feed, jelo, menu, more, puzzles, quests, snac |
| `arena.bottom_nav.*` (analytics) | home, compete, feed, more, nets, puzzle, snac |

Literal labels observed: **Arena, Compete, Feed, Nets, Puzzles, Quests,
Streaks, Insights, Jelo, Menu, More, Snacc, Dailies, Home**.

`leftPane.*` adds: arena, blogs, compete, creatorsProgramme, dailyChallenge,
feed, feedback, groupPlay, jelo, joinDiscord, leaderboard, matiksPro, myProfile,
nets, puzzles, quests, referAFriend.

`homeNav.*` (hamburger) sections: general, play, community, settingsSupport,
social, more. Items: certificates, clubs, community, compete, creators,
feedback, friends, groupPlay, insights, knowAboutFeatures, leaderboard, logout,
manageSubscription, messages, nets, referAFriend, review, settings, subscription,
widget.

`home.moreMenu.*` items: bugs, developer, discord, friends, group, matiksTv,
messages, plan, practice, ranks, rate, refer, settings.

## 2. Screen inventory (namespace sizes are dotted-key counts)

| Screens | namespace | keys |
|---|---|---|
| Insights / analysis | `insights` | 569 |
| Profile & edit profile | `profile` | 460 |
| App-wide analytics | `app` | 342 |
| League v2 (+Smart75) | `leagueV2` | 255 |
| Streak, calendar, shields | `streak` | 251 |
| Chat v2 (DM + groups + staked challenges) | `chatV2` | 230 |
| **Nets** (practice preset builder) | `nets` | 229 |
| **Jelo** (user-generated games) | `jelo` | 196 |
| Subscription / paywall | `subscription` | 193 |
| Contests (+`contests` list) | `contest`/`contests` | 185/44 |
| Flex (share duel result photos) | `flex` | 160 |
| Friends / follow graph | `friends` | 158 |
| **Daily challenge** | `dailyChallenge` | 150 |
| Store (pies, skips, shields, boosters) | `store` | 147 |
| Road to Kolkata event | `roadToKolkata` | 142 |
| **Infinite Puzzle** ladder | `infinitePuzzle` | 141 |
| Puzzles (hub + hints) | `puzzle` | 133 |
| Speed Run campaign | `speedRun` | 129 |
| Feed | `feed` | 122 |
| Duel shell (live match) | `gameV3` | 120 |
| Learning | `learn` | 115 |
| Practice | `practice` | 113 |
| Streak rewards (merch) | `streakRewards` | 113 |
| Settings | `settings` | 109 |
| Duel lobby + staking | `game`/`games` | 108/74 |
| Societies (clubs) | `societies` | 105 |
| Jelo studio | `jeloStudio` | 104 |
| Home | `home` | 100 |
| FIFA campaign | `fifaCampaign` | 99 |
| Onboarding | `onboarding`/`usOnboarding` | 89/60 |
| AlphaBot opponent | `alphaBot` | 80 |
| How to play (per game) | `howToPlayV2` | 69 |
| Showdown (weekend tournament) | `showdown` | 66 |
| Arena home analytics | `arena` | 62 |
| Buddy streak | `buddyStreak` | 54 |
| Starter quest | `starterQuest` | 50 |
| Achievements | `achievements` | 49 |
| Complete profile | `completeProfile` | 48 |
| Gamification/quests analytics | `gamification` | 47 |
| Delete account | `deleteAccount` | 44 |
| What's new modals | `whatsNew` | 37 |
| Leaderboard | `leaderboard` | 33 |
| Referral | `referral` | 33 |
| Certificates, legal, checkout, payment entry, share modals, mascot onboarding, queens, tango, `wendPuzzle`, `brumble`, memory rating | — | small |

Notable modals/sheets: `GameResultModal`, `PuzzleResultModal`, `ShareResultModal`,
`HowToPlayCompletionModal`, `StarterQuestModal`, `ProUpsellSheet`,
`HintPurchaseModal`, `PuzzleDateSelectorModal`, `AcceptChallengeBottomSheet`,
`AcceptStakedChallengeSheet`, `Buy{StreakShield,XPBooster,PiBundle,SnacSkips}BottomSheet`,
`CommentsSheet`, `MonthlyReportModal`, `LeagueV2InfoBottomSheet`.

Result/duel shell copy: `Rematch`, `New Game`, `Detailed Insights`,
`Match Details`, `Overview`, `Statistics`, `Preset Breakdown`,
`You Win`/`You Lost`, `Opponent Resigned`, `You Resigned`,
`Calculating Result...`, `Resyncing`, `Weak Internet`, `Exit`, `Resign`.

## 3. Core copy (literal English strings observed)

Global: `Play Now`, `Play`, `Continue`, `Cancel`, `Done`, `Save`, `Confirm`,
`Submit`, `Skip`, `Maybe Later`, `See All`, `Know More`, `Got it!`, `Claim`,
`Share Result`, `Invite Friends`, `Add Friend`, `Message`, `Block`, `Report`,
`Accept`, `Decline`, `Challenge`, `Rematch`, `Resign`, `Quit`, `Logout`.

Daily challenge: `Daily Challenge`, `How to play`, `Start Challenge`,
`View Result`, `Choose Challenge`, `Division 1/2/3`,
`Aim High! Keep climbing to compete at this level and join the elite.`,
`You Crushed Today's Challenge!`, `Lightning fast`, `True Ties`,
`A true tie is neither player solving in the tiebreaker minute.`

Store/monetization: `Buy More Pies`, `Pi Store`, `Pi Bundle`, `Pie Bundles`,
`Buy Pies`, `Not Enough Pies`, `Insufficient Pi Coins`, `Get Free Pies`,
`XP Booster`, `Streak Shield`, `Refill`, `Repair Streak`, `Start Fresh`,
`Skips in Snacc`, `Skips Everyday`, `Skips Available`, `SNAC Skips`,
`Spend Pies on streak shield, XP boosters, extra contest tries & more`,
`Know more about Pies, XP Booster, weekly leagues and streak shield`.

Streak: `A Streak Shield protects your streak on days when you miss playing.`,
`A 2-Day Streak Earns you a Streak Widget.`,
`A new streak! Play everyday to help it grow.`,
`Ready to protect your streak`, `days consistent`, `days protected`,
`Streak Shield Applied!`, `A month, every day. Very few make it.`,
`Wear your streak with pride!`, `Play everyday to keep it alive`.

Onboarding: `Continue with Google`, `Use Mobile Number`, `Enter OTP`,
`Username`, `Your Brain Rot Score`, `Analyzing`, `Math Speed`, `Memory`,
`Focus`, `Your Score`, `Create Account`, `Welcome Back`,
`What are you here for?` with options `Be Productive`, `Compete with Friends`,
`Build a healthy habit`, `Just for fun`, `Prepare for exams`, `Something else`;
interest options `Math games`, `Memory games`, `Puzzle games`, `Not sure`.

Nets (practice): `Create Preset`, `Practice Again`, `Most Practiced`,
`Last Practiced`, `Suggested`, `History`, `Questions Solved`, `Accuracy`,
`Median Time`, `You`/`Peer`, `Practice More`, `Tips`.

Flex: `Flex your Zaps`, `Camera access is needed to flex your duel.`,
`Choose a duel to flex`, `Your Flexes`, `View Flex`; reactions `Wow`,
`Well Played`, `Good Game`, `Celebrate`, `Like`.

Friends: `Find Friends`, `Sync Contacts`, `Suggested for you`,
`Search by username`, `Invite users to Matiks`, `Followers`, `Following`,
`Friends`, `Requests`, `Sent`, `Add friends to start sharing.`, `Messages`,
`Create Group`, `New Group`, `Add Members`, `Exit Group`,
`Stakes let both players bet Pie Coins on the challenge before it begins.`

Jelo: `Save My Spot`, `Create`, `Publish`, `Remix`, `Preview`,
`Join Waitlist`, `Enter invite code`, `Limited invite`, `You're on the list`.

Empty/error: `Something went wrong`, `Failed to load`, `No data available`,
`Try again`, `You don't have any friends yet`, `No past requests`.

## 4. Design tokens

Theme via `AppThemeProvider` / `createThemedStyles` / `useTheme`, accessors
`theme.space.*` and `theme.radius.*`. Scale keys:
`xxs, xs, sm, md, lg, xl, 2xl, 3xl, 4xl, full, none`.
Type roles: `display, h1..h6, title, subtitle, heading, body, label, caption,
micro`. Letter-spacing tokens: `BRAND_LETTER_SPACING`, `HEADLINE_LETTER_SPACING`,
`SCORE_LETTER_SPACING`.

**Fonts bundled:** Montserrat (primary, all weights + italics), Nunito Sans,
Bebas Neue, Chakra Petch, Roboto Mono, Space Mono, PopWarner, Tanker.

**Colour constants that exist as identifiers:** `COLORS`, `BRAND_COLORS`,
`ACCENT_COLORS`, `GRADIENT_COLORS`, `TEXT_COLORS`, `NAV_COLORS`,
`STREAK_COLORS`, `LEADERBOARD_COLORS`, `PUZZLE_COLORS`,
`CROSS_MATH_CELL_COLORS`, `KENKEN_CELL_COLORS`, `DEFAULT_SUDOKU_COLORS`,
`DEFAULT_KENKEN_COLORS`, `ZIP_COLORS`, `QUEENS_COLORS`, `PIPES_COLORS`,
`WIN_ACCENT_COLOR`, `LOSS_ACCENT_COLOR`, `SURFACE*`, `PRO_PURPLE*`,
`PRO_BADGE_SURFACE`, `FLEX_PICKER_LIME`.
Radii: `CARD_RADIUS`, `MODAL_CARD_RADIUS`, `PAYWALL_CARD_RADIUS`,
`NAV_TILE_RADIUS`, `GAME_SURFACE_RADIUS`, `CELL_BORDER_RADIUS`.

Verified brand values (pixel-sampled from the launcher assets, plus bundle):

| token | value |
|---|---|
| plate / dark surface | `#171717` (icon), `#0a0a0a`–`#121212` in-app |
| brand lime | `#b1fa63` (icon mark), also `#b6f36a`, `#bdff5a`, `#d4ff28` |
| lime veil | `rgba(195,250,99,0.2)` |
| Pro purple | `#7c5cff`, `#8b5cf6`, `#a855f7` |
| win gold | `#ffc300`, `#fbbf24` |
| loss red | `#ff3b30`, `#ef4444` |
| accent cyan | `#24fffb`, `#5fd7ff` |

Animations: `BounceIn*`, `FadeIn*`, `SlideIn*`, `FlipIn*`, `ZoomIn*`,
`LightSpeed*`, plus Reanimated transitions (`FadeTransition`,
`JumpingTransition`, `CurvedTransition`, `SharedTransition`).

## 5. Monetization & currencies

- **Pies / Pi Coins** — primary soft currency; also staked on duels
  (`Stakes let both players bet Pie Coins…`, `Not enough Pie Coins to place this
  bet`). Buys hints, skips, shields, boosters, contest entries.
- **Statik Coins** — second coin type (`STATIK_COINS`, `STATIC_COIN_LEADERBOARD`);
  exact role unknown.
- **Snacc/Snac Skips** — skip currency for the Snacc game; Pro grants unlimited,
  free tier gets 5/day; `infinitePuzzle.skipsBlocker.*` sells skips for the
  infinite ladder.
- **XP Booster** — timed multiplier, one at a time.
- **Streak Shields** — protect a missed day; `Refill`, `Repair Streak`.
- **Matiks Pro** — weekly / monthly / quarterly / annual cadences,
  `Best Value Badge`, `Most Popular Badge`, free trial, US-specific hard paywall,
  stores `App Store / Play Store / Razorpay / Web`. Pro perks: insights, duel
  analysis, flex, learn, bots, pro badge, unlimited Snacc skips, streak shields.
- **Physical rewards** — `streakRewards` day 50/100/200/365/500/700 merch and
  cake delivery; `roadToKolkata` finals flights; FIFA campaign jerseys.

## 6. Unknowns

- Which tabs are actually visible per platform (the three label sets disagree).
- Numeric values behind `SPACING`, `SURFACE`, radii and type sizes — only token
  names are recoverable.
- Screen ordering inside stacks; the key→English-value pairing (values are only
  present as a flat string pool).
- Exact role of Statik Coins; `Snacc` vs `Snac` naming.

## 7. What the web build maps this to

The reference app is a deep native navigator with dozens of surfaces. This build
keeps the destinations that carry real functionality and says so out loud
instead of shipping empty shells.

| Reference destination / surface | Web route | State |
|---|---|---|
| Arena (home) | `/` | Built: streak, Daily Challenge, duels, insights, XP board, store link |
| Puzzles hub | `/puzzles` | Built: daily set, Snacc ladder, duels, divisions |
| Daily Challenge (`dailyChallenge`, 150 keys) | `/daily` | Built: five seeded boards, divisions, min-score rule |
| Infinite Puzzle / **Snacc** (`infinitePuzzle`, 141 keys) | under `/puzzles` | Built: Queens, Tango, Zip, Pipes, Wend + skips |
| Compete (duels + contests) | `/compete` | Duels built; contests listed as **Needs server** |
| Quests | `/quests` | Built: five daily objectives on the evidenced counters |
| Store (`store`, 147 keys) | `/store` | Built as **Pi Store**: shields, skips, XP booster |
| Leaderboard | `/leaderboard` | Built: 3 scopes × 5 categories, non-player rows flagged as bots |
| Profile & insights (`profile` 460, `insights` 569) | `/profile`, `/more` | Built: lifetime stats, ratings, recent plays |
| Nets (practice) | — | Not built; linked from More |
| Feed, Friends, Chat, Jelo, Societies, Showdown, Flex, Matiks Pro, Streak Rewards merch | — | Not built (see §6 of the analysis doc) |

Navigation shape: the reference bottom bar is deep and feature-flagged across
three disagreeing label sets. The web build picks the five that work here —
Arena, Puzzles, Compete, Quests, More — in a centred 520px column with a sticky
top bar, so it reads as the same product in a browser without pretending to be
native.
