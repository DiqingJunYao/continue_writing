(() => {
  "use strict";

  const STORAGE_KEY = "branchline-demo-data-v1";
  const SESSION_KEY = "branchline-demo-session-v1";
  const PATH_KEY = "branchline-preferred-branches-v1";
  const SCHEMA_VERSION = 2;

  const initialData = {
    schemaVersion: SCHEMA_VERSION,
    users: [
      { id: "u1", name: "Maya Bennett", handle: "@mayawrites", initials: "MB", tone: "rose", role: "admin", bio: "Collector of strange doors and unfinished sentences." },
      { id: "u2", name: "Nora Vale", handle: "@noravale", initials: "NV", tone: "green", role: "user" },
      { id: "u3", name: "Theo Lin", handle: "@theolin", initials: "TL", tone: "blue", role: "user" },
      { id: "u4", name: "Imani Cross", handle: "@imanicross", initials: "IC", tone: "purple", role: "user" },
      { id: "u5", name: "Jules Park", handle: "@julespark", initials: "JP", tone: "green", role: "user" },
      { id: "u6", name: "Rowan Grey", handle: "@rowangrey", initials: "RG", tone: "blue", role: "user" }
    ],
    stories: [
      {
        id: "s1", parentId: null, rootId: "s1", authorId: "u2", status: "active", reportCount: 0, reportedBy: [],
        title: "The Last Lightkeeper", deck: "On the night the sea forgot the moon, Mara saw a light where no island should be.", genre: "Speculative",
        body: "The lighthouse had been dark for nineteen years when it blinked at Mara from beyond the reef. Once. Twice. Then a third time—slow and deliberate, like an old friend spelling her name across a crowded room.\n\nShe lowered the kettle from the stove and stepped onto the porch. All along the village, windows opened. No one spoke. They had buried the last lightkeeper with empty boots because the sea had kept the rest of him.\n\nOut past the black teeth of the reef, the impossible light turned once more. This time, it did not blink. It pointed straight at her.",
        createdAt: "Today, 8:42 PM", updatedAt: "Today", likes: 482, likedBy: [], views: 2814
      },
      {
        id: "s2", parentId: null, rootId: "s2", authorId: "u4", status: "active", reportCount: 0, reportedBy: [],
        title: "The House That Remembered Us", deck: "Every room kept a different version of the family who left it behind.", genre: "Magical realism",
        body: "When Celia unlocked the blue house, the hallway exhaled her childhood name. Not the name printed on her passport, but the small secret one her brother had used before either of them knew how to lie.\n\nDust rose from the floorboards in the shape of two running children. Somewhere upstairs, a tap began to drip in the rhythm of their mother's favorite song. Celia kept one hand on the open door.\n\nThe estate agent had promised the house was empty. The house, apparently, had not agreed.",
        createdAt: "Yesterday", updatedAt: "Yesterday", likes: 326, likedBy: [], views: 1940
      },
      {
        id: "s3", parentId: null, rootId: "s3", authorId: "u3", status: "active", reportCount: 1, reportedBy: ["u6"],
        title: "Platform Zero", deck: "The midnight train arrived at a platform that wasn't on any map.", genre: "Mystery",
        body: "At 12:03, the station clock skipped backward one minute and Platform Zero appeared between eleven and twelve. Elias watched the sign click into existence as if the bricks had simply remembered it.\n\nA silver train slid in without wind or sound. Every carriage was lit. Every seat was empty except one, where a red suitcase waited beneath a card bearing his name.\n\nThe doors opened. Behind him, all the clocks began counting down.",
        createdAt: "3 days ago", updatedAt: "2 days ago", likes: 219, likedBy: [], views: 1503
      },
      {
        id: "s1a", parentId: "s1", rootId: "s1", authorId: "u1", status: "active", reportCount: 0, reportedBy: [],
        title: "A Signal in the Fog", deck: "Mara answers the impossible light—and something answers back.", genre: "Speculative",
        body: "Mara carried the old signal lamp down to the beach, though its brass was green and its wick had turned to powder. Her father had taught her the code when she was seven: one sweep for danger, two for safe passage, three for come home.\n\nShe struck a match. The lamp caught with a blue flame. Across the water, the distant beam vanished.\n\nThen the fog around her filled with bells. From somewhere beyond the reef came three slow sweeps of light. Come home, it said. Come home. Come home.",
        createdAt: "38 min ago", updatedAt: "38 min ago", likes: 231, likedBy: [], views: 1104
      },
      {
        id: "s1b", parentId: "s1", rootId: "s1", authorId: "u5", status: "active", reportCount: 3, reportedBy: ["u2", "u3", "u4"],
        title: "The Bell Below", deck: "The light is not a warning. It is a key.", genre: "Horror",
        body: "Mara knew the rhythm before she knew why. The light was keeping time with the chapel bell—but the chapel bell had been cut down years ago and melted into anchors.\n\nShe followed the pulse along the cliff path. With every flash, the sea retreated another yard, exposing stairs carved into the reef. At the bottom, where the water should have been deepest, a bronze door waited.\n\nSomething on the other side rang the bell again.",
        createdAt: "31 min ago", updatedAt: "31 min ago", likes: 187, likedBy: [], views: 896
      },
      {
        id: "s1c", parentId: "s1", rootId: "s1", authorId: "u6", status: "reported", deletionSource: "moderation", reportCount: 4, reportedBy: ["u1", "u2", "u3", "u4"],
        title: "What the Tide Returned", deck: "The sea gives back one thing it should have kept.", genre: "Speculative",
        body: "The tide withdrew so quickly that fish hung glittering in the mud. In the sudden silence, Mara heard footsteps crossing the exposed seabed.\n\nHer father came out of the fog wearing the coat he had drowned in. He had not aged a day. In one hand he held the lighthouse key; in the other, a fistful of wet stars.\n\n‘Don't let them relight it,’ he said, and looked over his shoulder at the approaching beam.",
        createdAt: "22 min ago", updatedAt: "10 min ago", likes: 94, likedBy: [], views: 511
      },
      {
        id: "s1a1", parentId: "s1a", rootId: "s1", authorId: "u3", status: "active", reportCount: 0, reportedBy: [],
        title: "The Name in the Static", deck: "There are voices between the flashes, and one of them knows Mara.", genre: "Speculative",
        body: "Between the bells, the dead radio in Mara's pocket crackled. She pulled it out and watched the dial turn by itself past every marked frequency.\n\nA child's voice surfaced through the static. It recited coordinates, then a date nineteen years gone, then the name Mara's mother had chosen for a second daughter who was never born.\n\nOut at sea, the light began drawing a door.",
        createdAt: "12 min ago", updatedAt: "12 min ago", likes: 88, likedBy: [], views: 412
      },
      {
        id: "s1a2", parentId: "s1a", rootId: "s1", authorId: "u1", status: "active", reportCount: 0, reportedBy: [],
        title: "Three Sweeps Home", deck: "Mara takes the old code literally.", genre: "Adventure",
        body: "Mara turned the lamp toward the village and answered with three sweeps of her own. Come home. The blue flame leapt higher with each pass.\n\nEvery dark window behind her lit at once. Not with electricity, but with the warm gold of rooms she remembered: her father's workshop, her mother's kitchen, the bedroom they had locked after the funeral.\n\nThe village road stretched toward the sea, becoming a bridge of light. Mara stepped onto it before fear could learn her name.",
        createdAt: "8 min ago", updatedAt: "8 min ago", likes: 71, likedBy: [], views: 308
      },
      {
        id: "s1b1", parentId: "s1b", rootId: "s1", authorId: "u4", status: "active", reportCount: 0, reportedBy: [],
        title: "Under the Bronze Door", deck: "Mara enters the chamber beneath the missing sea.", genre: "Horror",
        body: "The bronze door opened inward before Mara touched it. Warm air breathed across her face, carrying candle smoke and salt.\n\nBelow the reef was a room larger than the village. Thousands of bells hung from its ceiling, each engraved with a name. One was ringing. Her name moved across its metal in letters that had not been there a moment ago.\n\nA ladder waited beneath it.",
        createdAt: "14 min ago", updatedAt: "14 min ago", likes: 63, likedBy: [], views: 290
      },
      {
        id: "s1c1", parentId: "s1c", rootId: "s1", authorId: "u5", status: "active", reportCount: 0, reportedBy: [],
        title: "Salt in Her Pockets", deck: "The hidden chapter is gone, but its branch continues.", genre: "Speculative",
        body: "Mara found the key in her pocket without remembering how it got there. Salt crusted its teeth, and a thin red thread was tied through the bow.\n\nThe beam swept over her. For a heartbeat she saw every path the night might take, branching bright across the water. Most ended at the lighthouse. One ended beneath her feet.\n\nShe chose the path no light had touched.",
        createdAt: "6 min ago", updatedAt: "6 min ago", likes: 51, likedBy: [], views: 214
      },
      {
        id: "s2a", parentId: "s2", rootId: "s2", authorId: "u2", status: "active", reportCount: 0, reportedBy: [],
        title: "The Room Behind Tuesday", deck: "Celia finds a door that only exists one day each week.", genre: "Magical realism",
        body: "On the second-floor landing, Tuesday had its own door. The brass plaque said so in her mother's handwriting.\n\nCelia opened it onto a summer afternoon from 1997. Her brother sat cross-legged on the carpet, building a city from blue blocks. He looked up, twenty years younger than the day he died, and frowned.\n\n‘You took your time,’ he said.",
        createdAt: "Yesterday", updatedAt: "Yesterday", likes: 146, likedBy: [], views: 802
      },
      {
        id: "s2b", parentId: "s2", rootId: "s2", authorId: "u1", status: "draft", reportCount: 0, reportedBy: [],
        title: "What the Wallpaper Heard", deck: "A draft continuation.", genre: "Mystery",
        body: "The wallpaper whispered after midnight. Celia pressed her ear to the faded roses and heard the family arguing on the other side.",
        createdAt: "Today", updatedAt: "Today", likes: 0, likedBy: [], views: 0
      },
      {
        id: "s2a1", parentId: "s2a", rootId: "s2", authorId: "u1", status: "deleted", deletionSource: "author", reportCount: 0, reportedBy: [],
        title: "The Blue Block City", deck: "A deleted chapter with a living continuation.", genre: "Magical realism",
        body: "Celia knelt beside the city and recognized its streets. Her brother had built the neighborhood exactly as it stood today, down to the burned-out bakery that would not close for another decade.",
        createdAt: "Yesterday", updatedAt: "Today", likes: 23, likedBy: [], views: 121
      },
      {
        id: "s2a1a", parentId: "s2a1", rootId: "s2", authorId: "u4", status: "active", reportCount: 0, reportedBy: [],
        title: "A Map Made of Memory", deck: "The lost chapter still points somewhere.", genre: "Magical realism",
        body: "Without the missing account, Celia had only the city of blocks. She photographed it from above and discovered that every blue roof marked a place someone in her family had forgotten on purpose.\n\nOne stood where no building existed. Yet.\n\nHer brother handed her the smallest block. ‘This is where you buried the key,’ he said.",
        createdAt: "4 hours ago", updatedAt: "4 hours ago", likes: 39, likedBy: [], views: 177
      },
      {
        id: "s3a", parentId: "s3", rootId: "s3", authorId: "u1", status: "active", reportCount: 0, reportedBy: [],
        title: "The Passenger List", deck: "Elias finds his name on more than one journey.", genre: "Mystery",
        body: "The card on the suitcase listed not one destination but seven. Beside each was Elias's name in a different hand.\n\nHe opened the case. Inside lay seven photographs of himself stepping off the silver train, each at a different age. In the last, he was older than his father had lived to be.\n\nA conductor cleared her throat behind him. ‘Which ending did you reserve?’ she asked.",
        createdAt: "2 days ago", updatedAt: "2 days ago", likes: 104, likedBy: [], views: 604
      }
    ],
    comments: [
      { id: "c1", storyId: "s1", parentCommentId: null, replyToCommentId: null, authorId: "u3", status: "active", text: "The three flashes gave me chills. I love how much room this leaves for the next writer.", createdAt: "34 min ago", likes: 42, likedBy: [] },
      { id: "c2", storyId: "s1", parentCommentId: "c1", replyToCommentId: "c1", authorId: "u1", status: "active", text: "Same! I took it as a message and ran with that in my version.", createdAt: "29 min ago", likes: 18, likedBy: [] },
      { id: "c3", storyId: "s1", parentCommentId: "c1", replyToCommentId: "c2", authorId: "u2", status: "active", text: "And your blue-flame detail was perfect. It feels like it always belonged here.", createdAt: "21 min ago", likes: 11, likedBy: [] },
      { id: "c4", storyId: "s1", parentCommentId: null, replyToCommentId: null, authorId: "u5", status: "active", text: "I read ‘pointed straight at her’ as a threat, which is how The Bell Below happened.", createdAt: "26 min ago", likes: 27, likedBy: [] },
      { id: "c5", storyId: "s1", parentCommentId: "c4", replyToCommentId: "c4", authorId: "u4", status: "active", text: "That branch is wonderfully unsettling.", createdAt: "13 min ago", likes: 7, likedBy: [] },
      { id: "c6", storyId: "s1a", parentCommentId: null, replyToCommentId: null, authorId: "u4", status: "active", text: "The old signal code makes the choice feel inevitable. Beautiful continuation.", createdAt: "17 min ago", likes: 15, likedBy: [] },
      { id: "c7", storyId: "s3a", parentCommentId: null, replyToCommentId: null, authorId: "u3", status: "active", text: "Seven endings! This is exactly the kind of branch I hoped someone would find.", createdAt: "1 day ago", likes: 23, likedBy: [] }
    ],
    notifications: [
      { id: "n1", type: "continuation", actorId: "u3", recipientId: "u1", storyId: "s1a1", targetStoryId: "s1a", read: false, createdAt: "12 min ago", quote: "The Name in the Static" },
      { id: "n2", type: "reply", actorId: "u2", recipientId: "u1", storyId: "s1", targetStoryId: "s1", read: false, createdAt: "21 min ago", quote: "your blue-flame detail was perfect" },
      { id: "n3", type: "like", actorId: "u4", recipientId: "u1", storyId: "s3a", targetStoryId: "s3a", read: false, createdAt: "3 hours ago", quote: "The Passenger List" },
      { id: "n4", type: "comment", actorId: "u3", recipientId: "u1", storyId: "s3a", targetStoryId: "s3a", read: true, createdAt: "1 day ago", quote: "Seven endings!" },
      { id: "n5", type: "continuation", actorId: "u4", recipientId: "u1", storyId: "s2a1a", targetStoryId: "s2a1", read: true, createdAt: "4 hours ago", quote: "A Map Made of Memory" }
    ],
    auditLog: [],
    demoAuthProviders: {}
  };

  const clone = (value) => JSON.parse(JSON.stringify(value));

  function loadData() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      const valid = saved
        && saved.schemaVersion === SCHEMA_VERSION
        && Array.isArray(saved.users)
        && Array.isArray(saved.stories)
        && Array.isArray(saved.comments)
        && Array.isArray(saved.notifications);
      if (valid) {
        saved.auditLog = Array.isArray(saved.auditLog) ? saved.auditLog : [];
        saved.demoAuthProviders = saved.demoAuthProviders && typeof saved.demoAuthProviders === "object"
          ? saved.demoAuthProviders
          : {};
        saved.stories.forEach((story) => {
          story.reportedBy = Array.isArray(story.reportedBy) ? story.reportedBy : [];
          story.likedBy = Array.isArray(story.likedBy) ? story.likedBy : [];
          if (!story.deletionSource && story.status === "reported") story.deletionSource = "moderation";
          if (!story.deletionSource && story.status === "deleted") story.deletionSource = "author";
        });
        saved.comments.forEach((comment) => {
          comment.likedBy = Array.isArray(comment.likedBy) ? comment.likedBy : [];
          if (!comment.deletionSource && comment.status === "deleted") comment.deletionSource = "story";
        });
        saved.notifications.forEach((notification) => {
          if (!notification.recipientId) notification.recipientId = "u1";
        });
        return saved;
      }
    } catch (error) {
      console.warn("Could not load saved Branchline data", error);
    }
    return clone(initialData);
  }

  function loadSession() {
    try {
      return JSON.parse(localStorage.getItem(SESSION_KEY)) || { userId: null };
    } catch {
      return { userId: null };
    }
  }

  function loadPreferredBranches() {
    try {
      return JSON.parse(localStorage.getItem(PATH_KEY)) || {};
    } catch {
      return {};
    }
  }

  let data = loadData();
  let session = loadSession();
  let preferredChildByParent = loadPreferredBranches();
  let pendingAuthAction = null;
  let activeCommentsStoryId = null;
  let replyTargetId = null;
  let inboxFilter = "all";
  let profileFilter = "stories";
  let expandedReplyThreads = new Set();
  let wheelLocked = false;
  let touchStart = null;

  const main = document.getElementById("main-content");
  const header = document.getElementById("site-header");
  const footer = document.getElementById("site-footer");
  const appDialog = document.getElementById("app-dialog");
  const commentsDialog = document.getElementById("comments-dialog");
  const toastRegion = document.getElementById("toast-region");

  function saveData() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  function saveSession() {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }

  function savePreferredBranches() {
    localStorage.setItem(PATH_KEY, JSON.stringify(preferredChildByParent));
  }

  function escapeHTML(value = "") {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function renderParagraphs(value = "") {
    return String(value)
      .split(/\n\s*\n/)
      .filter(Boolean)
      .map((paragraph) => `<p>${escapeHTML(paragraph)}</p>`)
      .join("");
  }

  function createId(prefix) {
    const randomPart = globalThis.crypto?.randomUUID?.()
      || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    return `${prefix}-${randomPart}`;
  }

  function recordAudit(action, story, previousStatus = null) {
    data.auditLog.push({
      id: createId("audit"),
      action,
      actorId: currentUser()?.id || null,
      storyId: story?.id || null,
      previousStatus,
      createdAt: new Date().toISOString()
    });
  }

  function addNotification({ type, actorId, recipientId, storyId, targetStoryId = storyId, quote = "" }) {
    if (!actorId || !recipientId || actorId === recipientId) return;
    if (!data.users.some((user) => user.id === recipientId)) return;
    data.notifications.unshift({
      id: createId("notification"),
      type,
      actorId,
      recipientId,
      storyId,
      targetStoryId,
      read: false,
      createdAt: "Just now",
      quote
    });
  }

  function notificationsForUser(userId = currentUser()?.id) {
    if (!userId) return [];
    return data.notifications.filter((notification) => notification.recipientId === userId);
  }

  function icon(name, className = "") {
    const paths = {
      search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
      bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>',
      plus: '<path d="M12 5v14M5 12h14"/>',
      heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z"/>',
      message: '<path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z"/>',
      share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 10.5 6.8-4M8.6 13.5l6.8 4"/>',
      flag: '<path d="M5 22V4"/><path d="M5 4h12l-2 4 2 4H5"/>',
      chevronLeft: '<path d="m15 18-6-6 6-6"/>',
      chevronRight: '<path d="m9 18 6-6-6-6"/>',
      chevronUp: '<path d="m18 15-6-6-6 6"/>',
      chevronDown: '<path d="m6 9 6 6 6-6"/>',
      tree: '<path d="M12 3v18M12 8 7 5M12 12l5-3M12 16l-4 2"/><circle cx="7" cy="5" r="2"/><circle cx="17" cy="9" r="2"/><circle cx="8" cy="18" r="2"/>',
      pen: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"/>',
      home: '<path d="m3 11 9-8 9 8"/><path d="M5 10v10h14V10M9 20v-6h6v6"/>',
      user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
      shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/>',
      logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5M21 12H9"/>',
      refresh: '<path d="M20 6v6h-6"/><path d="M4 18v-6h6"/><path d="M18.5 9A7 7 0 0 0 6 6.5L4 9m16 6-2 2.5A7 7 0 0 1 5.5 15"/>',
      x: '<path d="M18 6 6 18M6 6l12 12"/>',
      check: '<path d="m20 6-11 11-5-5"/>',
      trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 15H6L5 6M10 11v5M14 11v5"/>',
      edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"/>',
      eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
      branch: '<path d="M6 3v12a4 4 0 0 0 4 4h8"/><path d="m14 15 4 4-4 4"/><circle cx="6" cy="3" r="2"/><path d="M6 9h7a4 4 0 0 0 4-4V3"/><circle cx="17" cy="3" r="2"/>',
      book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V4H6.5A2.5 2.5 0 0 0 4 6.5Z"/><path d="M4 6.5v13A2.5 2.5 0 0 0 6.5 22H20"/>',
      copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
      info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
      sparkles: '<path d="m12 3-1.2 3.2L8 7.5l2.8 1.3L12 12l1.2-3.2L16 7.5l-2.8-1.3Z"/><path d="m19 14-.8 2.2L16 17l2.2.8L19 20l.8-2.2L22 17l-2.2-.8Z"/><path d="m5 13-.8 2.2L2 16l2.2.8L5 19l.8-2.2L8 16l-2.2-.8Z"/>',
      save: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z"/><path d="M17 21v-8H7v8M7 3v5h8"/>',
      alert: '<path d="m21.7 18-8-14a2 2 0 0 0-3.4 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3Z"/><path d="M12 9v4M12 17h.01"/>',
      clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
      thumbsUp: '<path d="M7 10v12H3V10h4Zm0 10h10.4a2 2 0 0 0 1.9-1.4l2.4-7A2 2 0 0 0 19.8 9H15l.7-3.5A3 3 0 0 0 12.8 2L7 10Z"/>',
      reply: '<path d="m9 17-5-5 5-5"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/>',
      lock: '<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
      more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>'
    };
    return `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.info}</svg>`;
  }

  function userById(id) {
    return data.users.find((user) => user.id === id) || { id: "unknown", name: "Former member", handle: "", initials: "?", tone: "green", role: "user" };
  }

  function storyById(id) {
    return data.stories.find((story) => story.id === id);
  }

  function currentUser() {
    return session.userId ? data.users.find((user) => user.id === session.userId) || null : null;
  }

  function avatar(user, size = "") {
    return `<span class="avatar ${size ? `avatar-${size}` : ""}" data-tone="${escapeHTML(user.tone || "green")}" aria-hidden="true">${escapeHTML(user.initials)}</span>`;
  }

  function visibleStories() {
    return data.stories.filter((story) => story.status !== "draft");
  }

  function childrenOf(storyId, includeDrafts = false) {
    return data.stories.filter((story) => story.parentId === storyId && (includeDrafts || story.status !== "draft"));
  }

  function siblingsOf(story) {
    return data.stories.filter((candidate) => candidate.parentId === story.parentId && candidate.status !== "draft");
  }

  function getAncestors(story) {
    const ancestors = [];
    let cursor = story;
    const seen = new Set();
    while (cursor && cursor.parentId && !seen.has(cursor.id)) {
      seen.add(cursor.id);
      const parent = storyById(cursor.parentId);
      if (!parent) break;
      ancestors.unshift(parent);
      cursor = parent;
    }
    return ancestors;
  }

  function getLevel(story) {
    return getAncestors(story).length;
  }

  function descendantCount(storyId) {
    let count = 0;
    const queue = childrenOf(storyId).map((story) => story.id);
    while (queue.length) {
      const id = queue.shift();
      count += 1;
      queue.push(...childrenOf(id).map((story) => story.id));
    }
    return count;
  }

  function commentCount(storyId) {
    return data.comments.filter((comment) => comment.storyId === storyId && comment.status === "active").length;
  }

  function wordCount(value = "") {
    return value.trim() ? value.trim().split(/\s+/).length : 0;
  }

  function formatStatus(status) {
    return status.charAt(0).toUpperCase() + status.slice(1);
  }

  function getRoute() {
    const raw = location.hash.replace(/^#\/?/, "");
    const parts = raw.split("/").filter(Boolean);
    if (!parts.length) return { name: "reader", storyId: "s1" };
    if (parts[0] === "story") return { name: "reader", storyId: parts[1] || "s1" };
    if (parts[0] === "write" && parts[1] === "continue") return { name: "write", mode: "continue", storyId: parts[2] };
    if (parts[0] === "write") return { name: "write", mode: "start" };
    if (parts[0] === "edit") return { name: "write", mode: "edit", storyId: parts[1] };
    if (parts[0] === "profile") return { name: "profile" };
    if (parts[0] === "inbox") return { name: "inbox" };
    if (parts[0] === "admin") return { name: "admin" };
    return { name: "reader", storyId: "s1" };
  }

  function routeTo(path) {
    const normalized = path.startsWith("#") ? path : `#${path}`;
    if (location.hash === normalized) {
      renderApp();
    } else {
      location.hash = normalized;
    }
  }

  function renderHeader(route) {
    const user = currentUser();
    const unreadCount = user ? notificationsForUser(user.id).filter((item) => !item.read).length : 0;
    const navIsActive = (name) => route.name === name ? " active" : "";
    header.innerHTML = `
      <div class="header-inner">
        <a class="brand" href="#story/s1" aria-label="Branchline home">
          <span class="brand-mark"><span class="brand-dot"></span></span>
          <span class="brand-name">Branchline</span>
        </a>
        <nav class="header-nav" aria-label="Primary navigation">
          <a class="nav-link${navIsActive("reader")}" href="#story/s1">Explore</a>
          <a class="nav-link mobile-keep${route.name === "write" ? " active" : ""}" href="#write/start">Start a story</a>
          ${user ? `<a class="nav-link${navIsActive("profile")}" href="#profile">My stories</a>` : ""}
          ${user?.role === "admin" ? `<a class="nav-link${navIsActive("admin")}" href="#admin">Moderation</a>` : ""}
        </nav>
        <div class="header-actions">
          <button class="icon-button search-trigger" type="button" data-action="search" aria-label="Search stories">${icon("search")}</button>
          ${user ? `
            <button class="icon-button" type="button" data-action="open-inbox" aria-label="Inbox${unreadCount ? `, ${unreadCount} unread` : ""}">
              ${icon("bell")}
              ${unreadCount ? `<span class="notification-badge">${unreadCount > 9 ? "9+" : unreadCount}</span>` : ""}
            </button>
            <button class="avatar-button" type="button" data-action="user-menu" aria-label="Open account menu">${avatar(user, "sm")}</button>
          ` : `
            <button class="button button-primary" type="button" data-action="sign-in">Sign in</button>
          `}
        </div>
      </div>
    `;
  }

  function renderFooter() {
    footer.innerHTML = `
      <div class="footer-inner">
        <div class="footer-brand"><span class="brand-mark"><span class="brand-dot"></span></span>Branchline</div>
        <p class="footer-copy">Stories don't have to end where one writer stops. Choose a branch, add your voice, and leave the next door open.</p>
        <nav class="footer-links" aria-label="Footer navigation">
          <a class="footer-link" href="#story/s1">Explore stories</a>
          <a class="footer-link" href="#write/start">Start writing</a>
          <button class="footer-link" type="button" data-action="about">How it works</button>
          <button class="footer-link" type="button" data-action="community-guidelines">Community guidelines</button>
        </nav>
      </div>
    `;
  }

  function showToast(message, type = "success") {
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.setAttribute("role", "status");
    toast.innerHTML = `<span class="toast-icon">${icon(type === "success" ? "check" : "info")}</span><span>${escapeHTML(message)}</span>`;
    toastRegion.appendChild(toast);
    window.setTimeout(() => {
      toast.classList.add("removing");
      window.setTimeout(() => toast.remove(), 190);
    }, 3400);
  }

  function closeAppDialog() {
    if (appDialog.open) appDialog.close();
    appDialog.classList.remove("wide-dialog");
    appDialog.replaceChildren();
    if (!commentsDialog.open) document.body.classList.remove("dialog-open");
  }

  function openDialog({ title, subtitle = "", body = "", actions = "", wide = false, onReady = null }) {
    appDialog.classList.toggle("wide-dialog", wide);
    appDialog.innerHTML = `
      <div class="dialog-shell">
        <div class="dialog-header">
          <div class="dialog-heading">
            <h2 id="dialog-title">${escapeHTML(title)}</h2>
            ${subtitle ? `<p>${escapeHTML(subtitle)}</p>` : ""}
          </div>
          <button class="plain-icon-button dialog-close" type="button" data-action="close-dialog" aria-label="Close dialog">${icon("x")}</button>
        </div>
        <div class="dialog-body">${body}</div>
        ${actions ? `<div class="dialog-actions">${actions}</div>` : ""}
      </div>
    `;
    document.body.classList.add("dialog-open");
    if (!appDialog.open) appDialog.showModal();
    if (onReady) requestAnimationFrame(() => onReady(appDialog));
  }

  function openAuthModal(reason = "Join the story to keep writing.", afterAuth = null) {
    pendingAuthAction = afterAuth;
    openDialog({
      title: "Sign in to Branchline",
      subtitle: reason,
      body: `
        <div class="auth-intro">
          <div class="auth-mark">${icon("tree")}</div>
          <h2>Your next chapter starts here.</h2>
          <p>Readers are always welcome. Sign in with Google or Facebook to write, react, comment, and report.</p>
          <div class="oauth-stack">
            <button class="oauth-button" type="button" data-oauth="google">
              <span class="oauth-logo google">G</span><span>Continue with Google</span><span class="oauth-arrow">›</span>
            </button>
            <button class="oauth-button" type="button" data-oauth="facebook">
              <span class="oauth-logo facebook">f</span><span>Continue with Facebook</span><span class="oauth-arrow">›</span>
            </button>
          </div>
          <p class="auth-terms">Prototype sign-in opens the demo account. No external account is created.</p>
        </div>
      `
    });
  }

  function requireAuth(action, reason) {
    if (currentUser()) {
      action();
      return;
    }
    openAuthModal(reason, action);
  }

  function signIn(provider) {
    let demoUser = data.users.find((user) => user.id === data.demoAuthProviders[provider]);
    if (!demoUser) {
      const firstName = provider === "facebook" ? "Facebook" : "Google";
      demoUser = {
        id: createId("user"),
        name: `${firstName} member`,
        handle: `@${provider}-member`,
        initials: provider === "facebook" ? "FB" : "GG",
        tone: provider === "facebook" ? "blue" : "rose",
        role: "user",
        bio: "A new Branchline member."
      };
      data.users.push(demoUser);
      data.demoAuthProviders[provider] = demoUser.id;
    }
    saveData();
    session = { userId: demoUser.id, provider };
    saveSession();
    closeAppDialog();
    const action = pendingAuthAction;
    pendingAuthAction = null;
    renderApp();
    showToast(`Signed in with ${provider === "facebook" ? "Facebook" : "Google"}. Welcome, ${demoUser.name.split(" ")[0]}!`);
    if (action) window.setTimeout(action, 80);
  }

  function renderAuthWall(title, message) {
    main.innerHTML = `
      <section class="auth-wall">
        <div class="auth-wall-card">
          <div class="auth-mark">${icon("lock")}</div>
          <h1>${escapeHTML(title)}</h1>
          <p>${escapeHTML(message)}</p>
          <button class="button button-primary" type="button" data-action="sign-in-route">Sign in with Google or Facebook</button>
          <br><br>
          <a class="back-link" href="#story/s1">${icon("chevronLeft")} Keep reading as a guest</a>
        </div>
      </section>
    `;
  }

  function openUserMenu() {
    const user = currentUser();
    if (!user) return;
    openDialog({
      title: "Account",
      body: `
        <div class="user-menu">
          <div class="user-menu-header">
            ${avatar(user)}
            <div><strong>${escapeHTML(user.name)}</strong><span>${escapeHTML(user.handle)} · ${user.role === "admin" ? "Administrator demo" : "Member demo"}</span></div>
          </div>
          <div class="user-menu-links">
            <a class="user-menu-link" href="#profile" data-action="close-dialog">${icon("user")} My profile</a>
            <a class="user-menu-link" href="#inbox" data-action="close-dialog">${icon("bell")} Inbox</a>
            ${user.role === "admin" ? `<a class="user-menu-link" href="#admin" data-action="close-dialog">${icon("shield")} Moderation</a>` : ""}
            ${user.role === "admin" ? `<button class="user-menu-link" type="button" data-action="reset-demo">${icon("refresh")} Reset demo data</button>` : ""}
            <button class="user-menu-link danger" type="button" data-action="sign-out">${icon("logout")} Sign out</button>
          </div>
        </div>
      `
    });
  }

  function openInfoDialog(type) {
    const isGuidelines = type === "guidelines";
    openDialog({
      title: isGuidelines ? "Community guidelines" : "How Branchline works",
      body: isGuidelines ? `
        <p>Build on each other with care. Keep continuations relevant to the story, credit the branch you inherit, and avoid harassment, hate, explicit exploitation, or personal information.</p>
        <p>Use the visible <strong>Report</strong> control for content that breaks these rules. A fourth distinct report automatically hides the chapter for administrator review; the branch itself stays connected.</p>
      ` : `
        <p>Every chapter is a node in a story tree. Scroll down to follow a continuation, scroll up to return to its parent, and use the left and right controls to compare alternate versions written from the same chapter.</p>
        <p>Removed chapters become placeholders instead of disappearing, so the stories written after them remain discoverable. Guests can read and share; signed-in members can write, react, comment, and report.</p>
      `
    });
  }

  function renderApp() {
    const route = getRoute();
    renderHeader(route);
    renderFooter();
    footer.hidden = false;

    if (route.name === "reader") {
      renderReader(route.storyId);
    } else if (route.name === "write") {
      renderWriter(route);
    } else if (route.name === "profile") {
      renderProfile();
    } else if (route.name === "inbox") {
      renderInbox();
    } else if (route.name === "admin") {
      renderAdmin();
    }

    document.title = route.name === "reader" ? "Branchline — Every story can become many" : `${route.name.charAt(0).toUpperCase() + route.name.slice(1)} — Branchline`;
  }

  function renderLineage(story) {
    const path = [...getAncestors(story), story];
    return `
      <div class="rail-card">
        <div class="rail-card-inner">
          <p class="rail-title">Your path</p>
          <ol class="lineage-list">
            ${path.map((item, index) => `
              <li class="lineage-item ${item.id === story.id ? "current" : ""}">
                <span class="lineage-node"></span>
                <button class="lineage-link" type="button" data-story-id="${item.id}" ${item.id === story.id ? 'aria-current="page"' : ""}>
                  <span class="sr-only">Level ${index}: </span>${escapeHTML(item.status === "active" ? item.title : item.status === "reported" ? "Reported chapter" : "Deleted chapter")}
                </button>
              </li>
            `).join("")}
          </ol>
        </div>
      </div>
    `;
  }

  function renderReaderKey() {
    return `
      <div class="rail-card">
        <div class="rail-card-inner">
          <p class="rail-title">Move through the tree</p>
          <div class="reader-key">
            <div class="key-row"><span class="keycap">↑</span><span>Return to the parent chapter</span></div>
            <div class="key-row"><span class="keycap">↓</span><span>Follow a continuation</span></div>
            <div class="key-row"><span class="keycap">↔</span><span>Compare alternate versions</span></div>
          </div>
        </div>
      </div>
    `;
  }

  function renderBranchMap(story) {
    const children = childrenOf(story.id);
    if (!children.length) {
      return `
        <div class="rail-card rail-start-card">
          <div class="branch-art">${icon("branch")}</div>
          <h3>${story.status === "active" ? "This branch is waiting." : "No later branches yet."}</h3>
          <p>${story.status === "active" ? "Be the first to decide what happens after this chapter." : "This unavailable chapter remains connected, but it cannot receive new continuations."}</p>
          ${story.status === "active" ? `<button class="button" type="button" data-action="continue-story" data-story-id="${story.id}">Continue it</button>` : ""}
        </div>
      `;
    }

    const selectedId = preferredChildByParent[story.id] || children[0].id;
    return `
      <div class="rail-card branch-map">
        <div class="branch-map-header">
          <h3>Next branches</h3>
          <p>${children.length} ${children.length === 1 ? "continuation" : "different directions"}</p>
        </div>
        <ul class="mini-branch-list">
          ${children.map((child) => `
            <li class="mini-branch-item">
              <button class="mini-branch-button ${child.id === selectedId ? "selected" : ""}" type="button" data-select-child="${child.id}" data-parent-id="${story.id}">
                <span class="mini-branch-dot"></span>
                <span class="mini-branch-copy">
                  <strong>${escapeHTML(child.status === "active" ? child.title : child.status === "reported" ? "Reported chapter" : "Deleted chapter")}</strong>
                  <span>${child.status === "active" ? `${escapeHTML(userById(child.authorId).name)} · ${child.likes} likes` : "Content unavailable · branch preserved"}</span>
                </span>
              </button>
            </li>
          `).join("")}
        </ul>
      </div>
      ${story.status === "active" ? `
        <div class="rail-card rail-start-card">
          <div class="branch-art">${icon("pen")}</div>
          <h3>Take it somewhere new.</h3>
          <p>Your continuation becomes another branch at the next level.</p>
          <button class="button" type="button" data-action="continue-story" data-story-id="${story.id}">Write a version</button>
        </div>
      ` : ""}
    `;
  }

  function renderTombstone(story) {
    const descendants = descendantCount(story.id);
    const reported = story.status === "reported";
    return `
      <div class="tombstone-content">
        <div class="tombstone-inner">
          <div class="tombstone-icon ${reported ? "reported" : ""}">${icon(reported ? "flag" : "trash")}</div>
          <h2 id="tombstone-title">${reported ? "This chapter is under review" : "This chapter was deleted"}</h2>
          <p>${reported ? "The chapter is hidden after community reports and is awaiting an administrator decision." : "The author removed this chapter. Its place in the story is preserved so later continuations stay connected."}</p>
          ${descendants ? `<span class="continuation-note">${icon("branch")} ${descendants} ${descendants === 1 ? "later chapter remains" : "later chapters remain"}</span>` : ""}
        </div>
      </div>
    `;
  }

  function renderStoryCard(story) {
    const siblings = siblingsOf(story);
    const siblingIndex = siblings.findIndex((item) => item.id === story.id);
    const level = getLevel(story);
    const author = userById(story.authorId);
    const children = childrenOf(story.id);
    const user = currentUser();
    const isLiked = Boolean(user && story.likedBy.includes(user.id));
    const isActive = story.status === "active";
    const versionLabel = level === 0 ? `Root ${siblingIndex + 1} of ${siblings.length}` : `Version ${siblingIndex + 1} of ${siblings.length}`;
    const parent = story.parentId ? storyById(story.parentId) : null;
    const parentLabel = parent?.status === "active" ? parent.title : "Unavailable chapter";

    return `
      <article class="story-card" id="story-card" aria-labelledby="${isActive ? "story-title" : "tombstone-title"}" tabindex="0">
        <div class="story-card-header">
          <div class="version-nav">
            <button class="version-button" type="button" data-story-nav="left" aria-label="Previous version" ${siblingIndex <= 0 ? "disabled" : ""}>${icon("chevronLeft")}</button>
          </div>
          <div class="version-meta">
            <p class="version-eyebrow">Level ${level}</p>
            <p class="version-text">${escapeHTML(versionLabel)}${parent ? ` · after “${escapeHTML(parentLabel)}”` : ""}</p>
          </div>
          <div class="version-nav end">
            <button class="version-button" type="button" data-story-nav="right" aria-label="Next version" ${siblingIndex >= siblings.length - 1 ? "disabled" : ""}>${icon("chevronRight")}</button>
          </div>
        </div>

        ${isActive ? `
          <div class="story-card-content">
            <div class="story-topline">
              <div class="author-line">
                ${avatar(author)}
                <div class="author-copy"><strong>${escapeHTML(author.name)}</strong><span>${escapeHTML(story.createdAt)} · ${escapeHTML(story.genre)}</span></div>
              </div>
              <button class="report-button" type="button" data-action="report-story" data-story-id="${story.id}" aria-label="Report this chapter">${icon("flag")}<span>Report</span></button>
            </div>
            <h2 class="story-title" id="story-title">${escapeHTML(story.title)}</h2>
            ${story.deck ? `<p class="story-deck">${escapeHTML(story.deck)}</p>` : ""}
            <div class="story-body">${renderParagraphs(story.body)}</div>
          </div>
          <div class="story-card-footer" role="group" aria-label="Story actions">
            <button class="action-button ${isLiked ? "active" : ""}" type="button" data-action="like-story" data-story-id="${story.id}" aria-label="${isLiked ? "Unlike" : "Like"} this chapter, ${story.likes} likes" aria-pressed="${isLiked}">
              ${icon("heart")}<span class="action-label">Like</span><span>${story.likes}</span>
            </button>
            <button class="action-button" type="button" data-action="open-comments" data-story-id="${story.id}" aria-label="Open comments, ${commentCount(story.id)} comments">
              ${icon("message")}<span class="action-label">Comments</span><span>${commentCount(story.id)}</span>
            </button>
            <button class="action-button" type="button" data-action="share-story" data-story-id="${story.id}" aria-label="Share this chapter">
              ${icon("share")}<span class="action-label">Share</span>
            </button>
            <button class="action-button continue-action" type="button" data-action="continue-story" data-story-id="${story.id}" aria-label="Continue writing after this chapter">
              ${icon("pen")}<span class="action-label">Continue</span>
            </button>
          </div>
        ` : `
          ${renderTombstone(story)}
          <div class="story-card-footer" role="group" aria-label="Story actions">
            <button class="action-button" type="button" data-action="share-story" data-story-id="${story.id}" aria-label="Share this branch">${icon("share")}<span class="action-label">Share branch</span></button>
            ${children.length ? `<span class="action-button" aria-hidden="true">${icon("branch")}<span class="action-label">Path preserved</span></span>` : ""}
          </div>
        `}
      </article>
    `;
  }

  function renderRootGrid() {
    const roots = data.stories.filter((story) => story.parentId === null && story.status !== "draft");
    return roots.map((story) => {
      const author = userById(story.authorId);
      const isActive = story.status === "active";
      const bodyPreview = isActive ? story.body.split(/\n\s*\n/)[0] : "This root chapter is currently unavailable, but its story tree remains accessible.";
      return `
        <article class="root-card" tabindex="0" role="link" data-story-id="${story.id}" aria-label="Read ${escapeHTML(isActive ? story.title : "this unavailable story")}">
          <span class="root-card-top"><span>${isActive ? escapeHTML(story.genre) : "Unavailable"}</span><span>${isActive ? `${story.views.toLocaleString()} reads` : "Path preserved"}</span></span>
          <h3>${escapeHTML(isActive ? story.title : story.status === "reported" ? "Reported story" : "Deleted story")}</h3>
          <p>${escapeHTML(bodyPreview)}</p>
          <span class="root-card-footer">
            <span class="root-author">${isActive ? `${avatar(author, "sm")} ${escapeHTML(author.name)}` : `${icon("branch")} Content unavailable`}</span>
            <span class="branch-stat">${descendantCount(story.id)} branches</span>
          </span>
        </article>
      `;
    }).join("");
  }

  function renderReader(requestedStoryId) {
    const story = storyById(requestedStoryId) || storyById("s1") || visibleStories()[0];
    if (!story) {
      main.innerHTML = `<div class="empty-state"><h2>No stories yet</h2><button class="button button-primary" data-action="start-story">Start the first one</button></div>`;
      return;
    }
    if (story.status === "draft") {
      const user = currentUser();
      const isOwner = user?.id === story.authorId;
      main.innerHTML = `
        <section class="auth-wall">
          <div class="auth-wall-card">
            <div class="auth-mark">${icon("edit")}</div>
            <h1>${isOwner ? "This chapter is still a draft." : "This chapter is not published."}</h1>
            <p>${isOwner ? "Continue editing it from your private drafts. It has not been added to the public story tree." : "Only the author can open this draft."}</p>
            ${isOwner ? `<a class="button button-primary" href="#edit/${story.id}">Edit draft</a>` : ""}
            <br><br><a class="back-link" href="#story/${story.parentId || "s1"}">${icon("chevronLeft")} Return to published stories</a>
          </div>
        </section>
      `;
      return;
    }
    const parent = story.parentId ? storyById(story.parentId) : null;
    const children = childrenOf(story.id);
    const selectedChildId = preferredChildByParent[story.id] || children[0]?.id;
    const selectedChild = storyById(selectedChildId);

    main.innerHTML = `
      <div class="reader-page">
        <section class="reader-intro" aria-labelledby="reader-heading">
          <div class="reader-intro-inner">
            <div>
              <p class="intro-label">Collaborative fiction, one branch at a time</p>
              <h1 id="reader-heading">Every story can become <em>many.</em></h1>
            </div>
            <button class="button button-coral" type="button" data-action="start-story">${icon("plus")} Start a story</button>
          </div>
        </section>

        <section class="reader-stage" aria-label="Story reader">
          <div class="stage-grid">
            <aside class="reader-rail left-rail" aria-label="Story path">
              ${renderLineage(story)}
              ${renderReaderKey()}
            </aside>

            <div class="story-column">
              <div class="vertical-nav">
                <button class="vertical-nav-button" type="button" data-story-nav="up" ${parent ? "" : "disabled"}>
                  ${icon("chevronUp")} ${parent ? `Level ${getLevel(story) - 1} · ${escapeHTML(parent.status === "active" ? parent.title : "Previous chapter")}` : "Beginning of this story"}
                </button>
              </div>

              ${renderStoryCard(story)}

              <div class="vertical-nav">
                ${children.length ? `
                  <button class="branch-choice-button" type="button" data-action="pick-branch" data-story-id="${story.id}">
                    ${icon("chevronDown")}
                    <span>${children.length === 1 ? `Continue to ${escapeHTML(selectedChild?.status === "active" ? selectedChild.title : "the next chapter")}` : `Choose from ${children.length} continuations`}</span>
                    <span class="branch-count">${children.length}</span>
                  </button>
                ` : story.status === "active" ? `
                  <button class="vertical-nav-button" type="button" data-action="continue-story" data-story-id="${story.id}">
                    ${icon("pen")} End of this branch · write what happens next
                  </button>
                ` : `
                  <div class="vertical-nav-button disabled" aria-label="No later chapter is connected">
                    ${icon("branch")} No later chapter is connected
                  </div>
                `}
              </div>
              <p class="stage-caption">Use the visible controls or arrow keys. Scroll navigation activates only when the full chapter fits on screen.</p>
            </div>

            <aside class="reader-rail right-rail" aria-label="Available continuations">
              ${renderBranchMap(story)}
            </aside>
          </div>
        </section>

        <section class="start-story-section" aria-labelledby="start-heading">
          <div class="start-story-inner">
            <div class="start-story-copy">
              <p class="section-kicker">Begin a new tree</p>
              <h2 id="start-heading">Give someone a place to begin.</h2>
              <p>Write the opening. Set the mood, leave a door ajar, and let other writers surprise you with where they take it.</p>
              <button class="button button-primary" type="button" data-action="start-story">${icon("pen")} Start a new story</button>
            </div>
            <div class="prompt-card" aria-label="Daily writing prompt">
              <p class="prompt-label">A spark, if you want one</p>
              <p class="prompt-text">“The package arrived twelve years late, and it was addressed in my own handwriting.”</p>
              <p class="prompt-meta">Today's community prompt</p>
            </div>
          </div>
        </section>

        <section class="explore-section" aria-labelledby="explore-heading">
          <div class="explore-inner">
            <div class="explore-header">
              <div><p class="section-kicker">Story beginnings</p><h2 id="explore-heading">Find another path in.</h2></div>
              <p>Each beginning grows its own tree. Pick one and see how many directions a single idea can travel.</p>
            </div>
            <div class="root-grid">${renderRootGrid()}</div>
          </div>
        </section>
      </div>
    `;

    requestAnimationFrame(bindReaderGestures);
  }

  function navigateStory(direction) {
    const route = getRoute();
    const story = storyById(route.storyId) || storyById("s1");
    if (!story) return;
    const siblings = siblingsOf(story);
    const index = siblings.findIndex((item) => item.id === story.id);
    let target = null;

    if (direction === "left" && index > 0) target = siblings[index - 1];
    if (direction === "right" && index < siblings.length - 1) target = siblings[index + 1];
    if (direction === "up" && story.parentId) target = storyById(story.parentId);
    if (direction === "down") {
      const children = childrenOf(story.id);
      const preferred = preferredChildByParent[story.id];
      target = children.find((item) => item.id === preferred) || children[0] || null;
    }

    if (target) {
      if (target.parentId) {
        preferredChildByParent[target.parentId] = target.id;
        savePreferredBranches();
      }
      const card = document.getElementById("story-card");
      if (card) card.classList.add("is-transitioning");
      window.setTimeout(() => routeTo(`story/${target.id}`), 110);
    } else if (direction === "down" && story.status === "active") {
      requireAuth(() => routeTo(`write/continue/${story.id}`), "Sign in to continue this branch.");
    }
  }

  function bindReaderGestures() {
    const card = document.getElementById("story-card");
    if (!card) return;
    const cardFitsViewport = () => card.scrollHeight <= Math.max(520, window.innerHeight - 120);

    card.addEventListener("wheel", (event) => {
      if (appDialog.open || commentsDialog.open || wheelLocked || Math.abs(event.deltaY) < 46) return;
      if (event.target.closest("button, input, textarea, select")) return;
      if (!cardFitsViewport()) return;
      event.preventDefault();
      wheelLocked = true;
      navigateStory(event.deltaY > 0 ? "down" : "up");
      window.setTimeout(() => { wheelLocked = false; }, 760);
    }, { passive: false });

    card.addEventListener("touchstart", (event) => {
      const touch = event.changedTouches[0];
      touchStart = { x: touch.clientX, y: touch.clientY };
    }, { passive: true });

    card.addEventListener("touchend", (event) => {
      if (!touchStart) return;
      const touch = event.changedTouches[0];
      const dx = touch.clientX - touchStart.x;
      const dy = touch.clientY - touchStart.y;
      touchStart = null;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 72) return;
      if (Math.abs(dx) > Math.abs(dy)) navigateStory(dx > 0 ? "left" : "right");
      else if (cardFitsViewport()) navigateStory(dy > 0 ? "up" : "down");
    }, { passive: true });
  }

  function openBranchPicker(storyId) {
    const story = storyById(storyId);
    const children = childrenOf(storyId);
    if (!story || !children.length) return;
    const selected = preferredChildByParent[storyId] || children[0].id;
    openDialog({
      title: "Choose the next branch",
      subtitle: story.status === "active" ? `All of these continue “${story.title}.”` : "The previous chapter is unavailable, but its later branches remain connected.",
      body: `<div class="branch-picker-list">
        ${children.map((child, index) => {
          const author = userById(child.authorId);
          return `
            <button class="branch-option ${child.id === selected ? "selected" : ""}" type="button" data-choose-branch="${child.id}" data-parent-id="${storyId}">
              <span class="branch-number">${index + 1}</span>
              <span class="branch-option-copy">
                <strong>${escapeHTML(child.status === "active" ? child.title : child.status === "reported" ? "Reported chapter" : "Deleted chapter")}</strong>
                <span>${child.status === "active" ? `by ${escapeHTML(author.name)} · ${child.likes} likes · ${commentCount(child.id)} comments` : "Content unavailable · branch preserved"}</span>
              </span>
              ${icon("chevronRight")}
            </button>
          `;
        }).join("")}
      </div>`,
      wide: true
    });
  }

  function selectAndOpenChild(parentId, childId) {
    preferredChildByParent[parentId] = childId;
    savePreferredBranches();
    closeAppDialog();
    routeTo(`story/${childId}`);
  }

  function toggleStoryLike(storyId) {
    const story = storyById(storyId);
    const user = currentUser();
    if (!story || !user || story.status !== "active") return;
    const index = story.likedBy.indexOf(user.id);
    if (index >= 0) {
      story.likedBy.splice(index, 1);
      story.likes = Math.max(0, story.likes - 1);
    } else {
      story.likedBy.push(user.id);
      story.likes += 1;
      addNotification({
        type: "like",
        actorId: user.id,
        recipientId: story.authorId,
        storyId: story.id,
        quote: story.title
      });
    }
    saveData();
    renderApp();
    if (index < 0) showToast("Added to your liked stories.");
  }

  function openShareDialog(storyId) {
    const story = storyById(storyId);
    if (!story) return;
    const shareUrl = `${location.origin}${location.pathname}#story/${story.id}`;
    openDialog({
      title: "Share this branch",
      subtitle: "The link opens this exact chapter in its story tree.",
      body: `
        <div class="share-preview"><strong>${escapeHTML(story.status === "active" ? story.title : "A chapter on Branchline")}</strong><span>${escapeHTML(shareUrl)}</span></div>
        <div class="copy-row">
          <input id="share-url" type="text" readonly value="${escapeHTML(shareUrl)}" aria-label="Story link">
          <button class="button button-primary" type="button" data-action="copy-share-link">${icon("copy")} Copy link</button>
        </div>
        ${navigator.share ? `<button class="button button-secondary" style="width:100%;margin-top:10px" type="button" data-action="native-share" data-story-id="${story.id}">${icon("share")} More sharing options</button>` : ""}
      `
    });
  }

  async function copyShareLink() {
    const field = document.getElementById("share-url");
    if (!field) return;
    try {
      await navigator.clipboard.writeText(field.value);
    } catch {
      field.select();
      document.execCommand("copy");
    }
    closeAppDialog();
    showToast("Story link copied.");
  }

  async function nativeShare(storyId) {
    const story = storyById(storyId);
    if (!story || !navigator.share) return;
    try {
      await navigator.share({
        title: story.status === "active" ? story.title : "A Branchline story",
        text: "Read this branch and choose where the story goes next.",
        url: `${location.origin}${location.pathname}#story/${story.id}`
      });
    } catch (error) {
      if (error?.name !== "AbortError") showToast("Sharing was not available.", "info");
    }
  }

  function openReportDialog(storyId) {
    const story = storyById(storyId);
    const user = currentUser();
    if (!story || !user || story.status !== "active") return;
    if (story.reportedBy.includes(user.id)) {
      showToast("You already reported this chapter.", "info");
      return;
    }
    openDialog({
      title: "Report this chapter?",
      subtitle: "Reports help the community stay thoughtful and safe.",
      body: `
        <div class="confirm-illustration">${icon("flag")}</div>
        <p>Report <strong>“${escapeHTML(story.title)}”</strong> for administrator review? You won't be able to report it again.</p>
        <p>When a chapter receives more than three distinct reports, its content is hidden automatically. The placeholder and all later branches remain connected.</p>
      `,
      actions: `
        <button class="button button-secondary" type="button" data-action="close-dialog">Cancel</button>
        <button class="button button-danger" type="button" data-action="confirm-report" data-story-id="${story.id}">${icon("flag")} Confirm report</button>
      `
    });
  }

  function confirmReport(storyId) {
    const story = storyById(storyId);
    const user = currentUser();
    if (!story || !user || story.status !== "active" || story.reportedBy.includes(user.id)) return;
    story.reportedBy.push(user.id);
    story.reportCount += 1;
    if (story.reportCount > 3) {
      const previousStatus = story.status;
      story.status = "reported";
      story.deletionSource = "moderation";
      recordAudit("story_auto_hidden", story, previousStatus);
    }
    story.updatedAt = "Just now";
    saveData();
    closeAppDialog();
    renderApp();
    showToast(story.status === "reported" ? "Report recorded. This chapter is now hidden for review." : "Report recorded. Thank you for letting us know.");
  }

  function renderComment(comment, isReply = false) {
    const author = userById(comment.authorId);
    const user = currentUser();
    const liked = Boolean(user && comment.likedBy.includes(user.id));
    const replyTo = comment.replyToCommentId ? data.comments.find((item) => item.id === comment.replyToCommentId) : null;
    const replyToUser = replyTo ? userById(replyTo.authorId) : null;
    return `
      <div class="comment-row" data-comment-id="${comment.id}">
        ${avatar(author, "sm")}
        <div class="comment-content">
          <div class="comment-meta"><strong>${escapeHTML(author.name)}</strong><span>${escapeHTML(comment.createdAt)}</span></div>
          <p class="comment-text">${isReply && replyToUser ? `<span class="replying-to">@${escapeHTML(replyToUser.name.split(" ")[0])}</span> ` : ""}${escapeHTML(comment.text)}</p>
          <div class="comment-actions">
            <button class="text-button ${liked ? "active" : ""}" type="button" data-comment-like="${comment.id}">${icon("thumbsUp")} ${comment.likes}</button>
            <button class="text-button" type="button" data-comment-reply="${comment.id}">${icon("reply")} Reply</button>
          </div>
        </div>
      </div>
    `;
  }

  function renderCommentsBody(storyId) {
    const story = storyById(storyId);
    if (!story) return "";
    const comments = data.comments.filter((comment) => comment.storyId === storyId && comment.status === "active");
    const roots = comments.filter((comment) => !comment.parentCommentId);
    const user = currentUser();
    const composer = user ? `
      <form class="comment-composer" id="comment-form" data-story-id="${storyId}">
        <div class="composer-row">
          ${avatar(user, "sm")}
          <div class="composer-field">
            <label class="sr-only" for="comment-text">Add a comment</label>
            <textarea id="comment-text" name="comment" placeholder="Add to the conversation…" maxlength="600" required></textarea>
            <div class="composer-actions"><span class="composer-hint">Keep it kind and story-focused.</span><button class="button button-primary button-small" type="submit">Comment</button></div>
          </div>
        </div>
      </form>
    ` : `
      <div class="comment-composer">
        <div class="guest-comment-gate"><p>Sign in to join the conversation.</p><button class="button button-primary button-small" type="button" data-action="comment-sign-in">Sign in</button></div>
      </div>
    `;

    return `
      <div class="comments-shell">
        <div class="comments-header">
          <div><h2 id="comments-title">Comments <span>${comments.length}</span></h2><p>On “${escapeHTML(story.status === "active" ? story.title : "this chapter")}”</p></div>
          <button class="plain-icon-button" type="button" data-action="close-comments" aria-label="Close comments">${icon("x")}</button>
        </div>
        ${composer}
        <div class="comments-scroll">
          ${roots.length ? roots.map((comment) => {
            const replies = comments.filter((reply) => reply.parentCommentId === comment.id);
            const expanded = expandedReplyThreads.has(comment.id);
            const target = replyTargetId ? data.comments.find((item) => item.id === replyTargetId) : null;
            const replyBelongsHere = target && (target.id === comment.id || target.parentCommentId === comment.id);
            return `
              <article class="comment-thread">
                ${renderComment(comment)}
                ${replies.length ? `
                  <button class="text-button view-replies" type="button" data-toggle-replies="${comment.id}">${icon(expanded ? "chevronUp" : "chevronDown")} ${expanded ? "Hide" : "View"} ${replies.length} ${replies.length === 1 ? "reply" : "replies"}</button>
                  ${expanded ? `<div class="reply-list">${replies.map((reply) => renderComment(reply, true)).join("")}</div>` : ""}
                ` : ""}
                ${user && replyBelongsHere ? `
                  <form class="inline-reply-form" data-root-comment-id="${comment.id}" data-reply-to-id="${target.id}">
                    <textarea name="reply" maxlength="600" required aria-label="Reply to ${escapeHTML(userById(target.authorId).name)}" placeholder="Reply to ${escapeHTML(userById(target.authorId).name.split(" ")[0])}…"></textarea>
                    <button class="button button-primary button-small" type="submit">Reply</button>
                  </form>
                ` : ""}
              </article>
            `;
          }).join("") : `
            <div class="empty-comments">${icon("message")}<p>No comments yet. Start the conversation.</p></div>
          `}
        </div>
      </div>
    `;
  }

  function openComments(storyId) {
    activeCommentsStoryId = storyId;
    replyTargetId = null;
    commentsDialog.innerHTML = renderCommentsBody(storyId);
    document.body.classList.add("dialog-open");
    if (!commentsDialog.open) commentsDialog.showModal();
  }

  function refreshComments() {
    if (!activeCommentsStoryId || !commentsDialog.open) return;
    commentsDialog.innerHTML = renderCommentsBody(activeCommentsStoryId);
  }

  function closeComments() {
    if (commentsDialog.open) commentsDialog.close();
    commentsDialog.replaceChildren();
    activeCommentsStoryId = null;
    replyTargetId = null;
    if (!appDialog.open) document.body.classList.remove("dialog-open");
  }

  function toggleCommentLike(commentId) {
    requireAuth(() => {
      const comment = data.comments.find((item) => item.id === commentId);
      const user = currentUser();
      if (!comment || !user || comment.status !== "active") return;
      const index = comment.likedBy.indexOf(user.id);
      if (index >= 0) {
        comment.likedBy.splice(index, 1);
        comment.likes = Math.max(0, comment.likes - 1);
      } else {
        comment.likedBy.push(user.id);
        comment.likes += 1;
        addNotification({
          type: "comment_like",
          actorId: user.id,
          recipientId: comment.authorId,
          storyId: comment.storyId,
          quote: comment.text
        });
      }
      saveData();
      refreshComments();
    }, "Sign in to like comments.");
  }

  function beginReply(commentId) {
    requireAuth(() => {
      const comment = data.comments.find((item) => item.id === commentId);
      if (!comment) return;
      replyTargetId = commentId;
      const rootId = comment.parentCommentId || comment.id;
      expandedReplyThreads.add(rootId);
      refreshComments();
      requestAnimationFrame(() => commentsDialog.querySelector(".inline-reply-form textarea")?.focus());
    }, "Sign in to reply to this comment.");
  }

  function addComment(storyId, text) {
    const user = currentUser();
    const story = storyById(storyId);
    if (!user || !story || story.status !== "active" || !text.trim()) return;
    data.comments.unshift({
      id: createId("comment"),
      storyId,
      parentCommentId: null,
      replyToCommentId: null,
      authorId: user.id,
      status: "active",
      text: text.trim(),
      createdAt: "Just now",
      likes: 0,
      likedBy: []
    });
    addNotification({
      type: "comment",
      actorId: user.id,
      recipientId: story.authorId,
      storyId,
      quote: text.trim()
    });
    saveData();
    refreshComments();
    renderHeader(getRoute());
    showToast("Comment posted.");
  }

  function addReply(rootCommentId, replyToId, text) {
    const user = currentUser();
    const target = data.comments.find((item) => item.id === replyToId);
    const story = target ? storyById(target.storyId) : null;
    if (!user || !target || target.status !== "active" || story?.status !== "active" || !text.trim()) return;
    const verifiedRootId = target.parentCommentId || target.id;
    if (rootCommentId !== verifiedRootId) return;
    data.comments.push({
      id: createId("comment"),
      storyId: target.storyId,
      parentCommentId: verifiedRootId,
      replyToCommentId: replyToId,
      authorId: user.id,
      status: "active",
      text: text.trim(),
      createdAt: "Just now",
      likes: 0,
      likedBy: []
    });
    addNotification({
      type: "reply",
      actorId: user.id,
      recipientId: target.authorId,
      storyId: target.storyId,
      quote: text.trim()
    });
    replyTargetId = null;
    expandedReplyThreads.add(verifiedRootId);
    saveData();
    refreshComments();
    showToast("Reply posted.");
  }

  function renderWriter(route) {
    footer.hidden = true;
    const user = currentUser();
    if (!user) {
      renderAuthWall(route.mode === "edit" ? "Sign in to edit your chapter." : "Sign in to write on Branchline.", "Guests can read every branch, but writing is for registered members.");
      return;
    }

    const sourceStory = route.storyId ? storyById(route.storyId) : null;
    const editing = route.mode === "edit";
    const continuing = route.mode === "continue";

    if ((editing || continuing) && !sourceStory) {
      main.innerHTML = `<div class="auth-wall"><div class="auth-wall-card"><h1>Chapter not found</h1><p>This chapter may no longer exist.</p><a class="button button-primary" href="#story/s1">Back to stories</a></div></div>`;
      return;
    }

    if (editing && sourceStory.authorId !== user.id) {
      main.innerHTML = `<div class="auth-wall"><div class="auth-wall-card"><div class="auth-mark">${icon("lock")}</div><h1>This chapter belongs to someone else.</h1><p>Writers can only edit their own work. You can still add a new continuation.</p><a class="button button-primary" href="#story/${sourceStory.id}">Read the chapter</a></div></div>`;
      return;
    }

    if (editing && !["active", "draft"].includes(sourceStory.status)) {
      main.innerHTML = `<div class="auth-wall"><div class="auth-wall-card"><div class="auth-mark">${icon("shield")}</div><h1>This chapter can't be edited.</h1><p>Deleted and reported chapters must be reviewed by an administrator. Editing cannot restore them.</p><a class="button button-primary" href="#story/${sourceStory.id}">Return to the branch</a></div></div>`;
      return;
    }

    if (continuing && sourceStory.status !== "active") {
      main.innerHTML = `<div class="auth-wall"><div class="auth-wall-card"><div class="auth-mark">${icon("branch")}</div><h1>This chapter can't be continued.</h1><p>Its path is preserved for existing descendants, but new continuations are paused while it is unavailable.</p><a class="button button-primary" href="#story/${sourceStory.id}">Return to the branch</a></div></div>`;
      return;
    }

    const formStory = editing ? sourceStory : null;
    const parentStory = continuing ? sourceStory : editing && sourceStory.parentId ? storyById(sourceStory.parentId) : null;
    const modeTitle = editing ? "Edit chapter" : continuing ? "Continue this story" : "Start a new story";
    const modeSubtitle = editing ? `Updating “${sourceStory.title}”` : continuing ? `Writing after “${sourceStory.title}”` : "Plant the first chapter of a new story tree";
    const isRootMode = !parentStory;
    const backHref = editing && sourceStory.status === "draft"
      ? "#profile"
      : editing || continuing ? `#story/${sourceStory.id}` : "#story/s1";

    main.innerHTML = `
      <div class="writer-page">
        <div class="writer-topbar">
          <div class="writer-topbar-inner">
            <a class="back-link" href="${backHref}">${icon("chevronLeft")} Back</a>
            <div class="writer-heading"><h1>${escapeHTML(modeTitle)}</h1><p>${escapeHTML(modeSubtitle)}</p></div>
            <span class="save-state" id="save-state"><span class="save-state-dot"></span>${formStory ? `Last saved ${escapeHTML(formStory.updatedAt)}` : "Draft ready"}</span>
            <button class="button button-secondary button-small" type="button" data-action="preview-draft">${icon("eye")} Preview</button>
          </div>
        </div>

        <div class="writer-layout ${isRootMode ? "root-mode" : ""}">
          ${parentStory ? `
            <aside class="reference-panel" aria-label="Previous chapter">
              <div class="panel-header"><div><h2>Previous chapter</h2><p>Read-only reference · scrolls independently</p></div><span class="level-tag">Level ${getLevel(parentStory)}</span></div>
              ${parentStory.status === "active" ? `
                <div class="reference-scroll">
                  <div class="author-line">${avatar(userById(parentStory.authorId), "sm")}<div class="author-copy"><strong>${escapeHTML(userById(parentStory.authorId).name)}</strong><span>${escapeHTML(parentStory.createdAt)}</span></div></div>
                  <h3>${escapeHTML(parentStory.title)}</h3>
                  <div class="reference-story-body">${renderParagraphs(parentStory.body)}</div>
                </div>
              ` : `
                <div class="tombstone-content">
                  <div class="tombstone-inner">
                    <div class="tombstone-icon ${parentStory.status === "reported" ? "reported" : ""}">${icon(parentStory.status === "reported" ? "flag" : "trash")}</div>
                    <h3>Previous chapter unavailable</h3>
                    <p>Its content is hidden, but your chapter remains connected to the story tree.</p>
                  </div>
                </div>
              `}
            </aside>
          ` : ""}

          <section class="editor-panel">
            <div class="panel-header"><div><h2>${editing ? "Your chapter" : "New chapter"}</h2><p>${editing ? "Changes replace your current version" : continuing ? "A new version at the next level" : "A new level 0 beginning"}</p></div>${editing ? `<span class="status-badge ${sourceStory.status}">${formatStatus(sourceStory.status)}</span>` : ""}</div>
            <form class="editor-form" id="story-editor" data-mode="${route.mode}" ${route.storyId ? `data-story-id="${route.storyId}"` : ""}>
              <div class="editor-scroll">
                <div class="field-group">
                  <div class="field-label-row"><label class="field-label" for="story-title-input">Chapter title</label><span class="field-count" id="title-count">${formStory?.title.length || 0}/80</span></div>
                  <input class="text-input title-input" id="story-title-input" name="title" type="text" maxlength="80" placeholder="Give this chapter a memorable name" value="${escapeHTML(formStory?.title || "")}" required>
                </div>

                <div class="field-group">
                  <div class="field-label-row"><label class="field-label" for="story-deck-input">One-line hook <span class="field-hint">optional</span></label><span class="field-count" id="deck-count">${formStory?.deck.length || 0}/140</span></div>
                  <textarea class="text-area summary-area" id="story-deck-input" name="deck" maxlength="140" placeholder="A hint of what this path holds…">${escapeHTML(formStory?.deck || "")}</textarea>
                </div>

                <div class="field-group">
                  <div class="field-label-row"><label class="field-label" for="story-body-input">Story</label><span class="field-count" id="word-count">${wordCount(formStory?.body || "")} words</span></div>
                  <textarea class="text-area" id="story-body-input" name="body" minlength="40" maxlength="8000" placeholder="Write what happens next…" required>${escapeHTML(formStory?.body || "")}</textarea>
                </div>

                <div class="field-group">
                  <div class="field-label-row"><label class="field-label" for="story-genre-input">Genre</label></div>
                  <select class="select-input" id="story-genre-input" name="genre">
                    ${["Speculative", "Fantasy", "Mystery", "Adventure", "Romance", "Science fiction", "Horror", "Magical realism", "Literary"].map((genre) => `<option ${formStory?.genre === genre ? "selected" : ""}>${genre}</option>`).join("")}
                  </select>
                </div>

                <div class="writing-tip">${icon("sparkles")}<span><strong>Leave a door open.</strong> The best Branchline chapters feel complete enough to satisfy and unfinished enough to invite another writer in.</span></div>
              </div>
              <div class="editor-footer">
                <span class="editor-note">${continuing ? `This becomes level ${getLevel(sourceStory) + 1}.` : editing ? "Your branch links stay unchanged." : "This becomes a new root story."}</span>
                ${!editing || sourceStory.status === "draft" ? `<button class="button button-secondary" type="button" data-action="save-draft">${icon("save")} Save draft</button>` : ""}
                <button class="button button-primary" type="submit">${editing && sourceStory.status === "active" ? "Save changes" : "Publish chapter"}</button>
              </div>
            </form>
          </section>
        </div>
      </div>
    `;
  }

  function readEditorValues() {
    const form = document.getElementById("story-editor");
    if (!form) return null;
    const formData = new FormData(form);
    return {
      title: String(formData.get("title") || "").trim(),
      deck: String(formData.get("deck") || "").trim(),
      body: String(formData.get("body") || "").trim(),
      genre: String(formData.get("genre") || "Speculative")
    };
  }

  function validateEditor(values, allowShortDraft = false) {
    if (!values?.title) {
      document.getElementById("story-title-input")?.focus();
      showToast("Give your chapter a title before saving.", "info");
      return false;
    }
    if (!allowShortDraft && wordCount(values.body) < 8) {
      document.getElementById("story-body-input")?.focus();
      showToast("Write at least a few sentences before publishing.", "info");
      return false;
    }
    return true;
  }

  function saveStoryFromEditor(asDraft = false) {
    const form = document.getElementById("story-editor");
    const user = currentUser();
    const values = readEditorValues();
    if (!form || !user || !validateEditor(values, asDraft)) return;
    const mode = form.dataset.mode;
    const sourceId = form.dataset.storyId;

    if (mode === "edit") {
      const story = storyById(sourceId);
      if (!story || story.authorId !== user.id || !["active", "draft"].includes(story.status)) return;
      if (asDraft) {
        if (story.status !== "draft") {
          showToast("Published chapters stay live while editing. Use Save changes when you're ready.", "info");
          return;
        }
        Object.assign(story, values, { status: "draft", updatedAt: "Just now" });
        saveData();
        showToast("Draft updated.");
        routeTo("profile");
        return;
      }
      const wasDraft = story.status === "draft";
      Object.assign(story, values, { status: "active", updatedAt: "Just now" });
      if (wasDraft && story.parentId) {
        preferredChildByParent[story.parentId] = story.id;
        savePreferredBranches();
        const parent = storyById(story.parentId);
        addNotification({
          type: "continuation",
          actorId: user.id,
          recipientId: parent?.authorId,
          storyId: story.id,
          targetStoryId: parent?.id,
          quote: story.title
        });
      }
      saveData();
      showToast(wasDraft ? "Draft published." : "Changes published.");
      routeTo(`story/${story.id}`);
      return;
    }

    const parent = mode === "continue" ? storyById(sourceId) : null;
    const id = createId("story");
    const story = {
      id,
      parentId: parent?.id || null,
      rootId: parent?.rootId || id,
      authorId: user.id,
      status: asDraft ? "draft" : "active",
      reportCount: 0,
      reportedBy: [],
      ...values,
      createdAt: "Just now",
      updatedAt: "Just now",
      likes: 0,
      likedBy: [],
      views: 1
    };
    data.stories.push(story);
    if (parent && !asDraft) {
      addNotification({
        type: "continuation",
        actorId: user.id,
        recipientId: parent.authorId,
        storyId: story.id,
        targetStoryId: parent.id,
        quote: story.title
      });
    }
    saveData();
    if (parent && !asDraft) {
      preferredChildByParent[parent.id] = story.id;
      savePreferredBranches();
    }
    showToast(asDraft ? "Draft saved to your profile." : parent ? "Your continuation is live." : "Your new story is live.");
    routeTo(asDraft ? "profile" : `story/${story.id}`);
  }

  function previewDraft() {
    const values = readEditorValues();
    if (!values) return;
    openDialog({
      title: values.title || "Untitled chapter",
      subtitle: `${wordCount(values.body)} words · Preview only`,
      wide: true,
      body: `
        ${values.deck ? `<p class="story-deck">${escapeHTML(values.deck)}</p>` : ""}
        <div class="story-body">${values.body ? renderParagraphs(values.body) : "<p>Your story preview will appear here.</p>"}</div>
      `
    });
  }

  function profileStoriesForFilter(user) {
    if (profileFilter === "liked") return data.stories.filter((story) => story.likedBy.includes(user.id) && story.status !== "draft");
    if (profileFilter === "drafts") return data.stories.filter((story) => story.authorId === user.id && story.status === "draft");
    return data.stories.filter((story) => story.authorId === user.id && story.status !== "draft");
  }

  function renderProfileStoryList(user) {
    const stories = profileStoriesForFilter(user);
    if (!stories.length) {
      const copy = profileFilter === "liked" ? "Stories you like will collect here." : profileFilter === "drafts" ? "You don't have any drafts yet." : "Your published chapters will appear here.";
      return `<div class="empty-state"><div class="empty-state-icon">${icon(profileFilter === "liked" ? "heart" : "book")}</div><h2>Nothing here yet</h2><p>${copy}</p>${profileFilter !== "liked" ? '<a class="button button-primary" href="#write/start">Start writing</a>' : ""}</div>`;
    }

    return `<ul class="story-list">
      ${stories.map((story) => {
        const level = getLevel(story);
        const parent = story.parentId ? storyById(story.parentId) : null;
        const parentLabel = parent?.status === "active" ? parent.title : "Unavailable chapter";
        const isOwner = story.authorId === user.id;
        const showPrivateMetadata = story.status === "active" || story.status === "draft" || isOwner;
        return `
          <li class="story-list-card" data-status="${story.status}">
            <span class="story-list-accent"></span>
            <div class="story-list-main">
              <div class="story-list-tags"><span class="status-badge ${story.status}">${formatStatus(story.status)}</span> <span class="level-tag">Level ${level}</span> <span class="genre-tag">${showPrivateMetadata ? escapeHTML(story.genre) : "Unavailable"}</span></div>
              <h3 style="margin:8px 0 0;font-family:var(--serif);font-size:1.25rem;letter-spacing:-.025em">${showPrivateMetadata ? escapeHTML(story.title) : story.status === "reported" ? "Reported chapter" : "Deleted chapter"}</h3>
              <p>${parent ? `Continues “${escapeHTML(parentLabel)}”` : "Root story"}</p>
              <div class="story-list-meta">
                <span>${icon("heart")} ${story.likes} likes</span>
                <span>${icon("message")} ${commentCount(story.id)} comments</span>
                <span>${icon("branch")} ${childrenOf(story.id).length} continuations</span>
                <span>${icon("clock")} Updated ${escapeHTML(story.updatedAt)}</span>
              </div>
            </div>
            <div class="story-list-actions">
              ${story.status !== "draft" ? `<button class="button button-secondary button-small" type="button" data-story-id="${story.id}">${icon("eye")} View</button>` : ""}
              ${isOwner && (story.status === "active" || story.status === "draft") ? `<a class="button button-secondary button-small" href="#edit/${story.id}">${icon("edit")} Edit</a>` : ""}
              ${isOwner && (story.status === "active" || story.status === "draft") ? `<button class="icon-button" type="button" data-delete-story="${story.id}" aria-label="Delete ${escapeHTML(story.title)}">${icon("trash")}</button>` : ""}
            </div>
          </li>
        `;
      }).join("")}
    </ul>`;
  }

  function renderProfile() {
    const user = currentUser();
    if (!user) {
      renderAuthWall("Your stories live here.", "Sign in to manage your chapters, drafts, and liked stories.");
      return;
    }
    const owned = data.stories.filter((story) => story.authorId === user.id);
    const published = owned.filter((story) => story.status !== "draft").length;
    const totalLikes = owned.reduce((sum, story) => sum + story.likes, 0);
    const totalBranches = owned.reduce((sum, story) => sum + childrenOf(story.id).length, 0);
    const drafts = owned.filter((story) => story.status === "draft").length;

    main.innerHTML = `
      <div class="standard-page">
        <section class="page-hero profile-hero">
          <div class="page-hero-inner">
            <p class="page-eyebrow">Writer profile</p>
            <h1 class="page-title">Your corner of the story.</h1>
          </div>
        </section>
        <div class="page-content">
          <section class="profile-card" aria-label="Profile summary">
            ${avatar(user, "lg")}
            <div class="profile-info">
              <h2>${escapeHTML(user.name)}</h2>
              <p style="margin:2px 0 0;color:var(--muted);font-size:.84rem">${escapeHTML(user.handle)} · ${escapeHTML(user.bio || "")}</p>
              <span class="profile-role">${icon(user.role === "admin" ? "shield" : "user")} ${user.role === "admin" ? "Administrator demo account" : "Member demo account"}</span>
            </div>
            <a class="button button-primary" href="#write/start">${icon("plus")} New story</a>
            <div class="profile-stats">
              <div class="profile-stat"><strong>${published}</strong><span>Chapters</span></div>
              <div class="profile-stat"><strong>${totalLikes}</strong><span>Likes</span></div>
              <div class="profile-stat"><strong>${totalBranches}</strong><span>New branches</span></div>
            </div>
          </section>

          <div class="content-toolbar">
            <div class="tabs" role="tablist" aria-label="Profile stories">
              <button class="tab-button ${profileFilter === "stories" ? "active" : ""}" id="profile-tab-stories" type="button" role="tab" data-profile-filter="stories" aria-selected="${profileFilter === "stories"}" aria-controls="profile-story-list" tabindex="${profileFilter === "stories" ? "0" : "-1"}">My stories <span>${published}</span></button>
              <button class="tab-button ${profileFilter === "drafts" ? "active" : ""}" id="profile-tab-drafts" type="button" role="tab" data-profile-filter="drafts" aria-selected="${profileFilter === "drafts"}" aria-controls="profile-story-list" tabindex="${profileFilter === "drafts" ? "0" : "-1"}">Drafts <span>${drafts}</span></button>
              <button class="tab-button ${profileFilter === "liked" ? "active" : ""}" id="profile-tab-liked" type="button" role="tab" data-profile-filter="liked" aria-selected="${profileFilter === "liked"}" aria-controls="profile-story-list" tabindex="${profileFilter === "liked" ? "0" : "-1"}">Liked</button>
            </div>
            <div class="toolbar-actions">
              <button class="button button-secondary button-small" type="button" data-action="account-data">Account data</button>
              <a class="button button-primary button-small" href="#write/start">${icon("pen")} Write</a>
            </div>
          </div>
          <section id="profile-story-list" role="tabpanel" aria-labelledby="profile-tab-${profileFilter}" tabindex="0" aria-live="polite">${renderProfileStoryList(user)}</section>
        </div>
      </div>
    `;
  }

  function confirmDeleteStory(storyId) {
    const story = storyById(storyId);
    const user = currentUser();
    if (!story || !user || story.authorId !== user.id || !["active", "draft"].includes(story.status)) return;
    const isDraft = story.status === "draft";
    const descendants = descendantCount(story.id);
    openDialog({
      title: isDraft ? "Delete this draft?" : "Delete this chapter?",
      subtitle: isDraft ? "This unpublished draft will be removed permanently." : "Its place in the story tree will be preserved.",
      body: `
        <div class="confirm-illustration">${icon("trash")}</div>
        <p>${isDraft ? `Permanently remove <strong>“${escapeHTML(story.title)}”</strong>? It has never been published.` : `The public content of <strong>“${escapeHTML(story.title)}”</strong> and its comments will be removed.`}</p>
        ${!isDraft && descendants ? `<p><strong>${descendants} ${descendants === 1 ? "later chapter" : "later chapters"}</strong> will remain readable. A deleted placeholder will connect them to the earlier story.</p>` : ""}
      `,
      actions: `
        <button class="button button-secondary" type="button" data-action="close-dialog">${isDraft ? "Keep draft" : "Keep chapter"}</button>
        <button class="button button-danger" type="button" data-action="confirm-delete-story" data-story-id="${story.id}">${icon("trash")} ${isDraft ? "Delete draft" : "Delete chapter"}</button>
      `
    });
  }

  function deleteStory(storyId) {
    const story = storyById(storyId);
    const user = currentUser();
    if (!story || !user || story.authorId !== user.id || !["active", "draft"].includes(story.status)) return;
    if (story.status === "draft") {
      data.stories = data.stories.filter((candidate) => candidate.id !== story.id);
      data.comments = data.comments.filter((comment) => comment.storyId !== story.id);
      delete preferredChildByParent[story.id];
      savePreferredBranches();
      saveData();
      closeAppDialog();
      renderProfile();
      showToast("Draft permanently deleted.");
      return;
    }
    story.status = "deleted";
    story.deletionSource = "author";
    story.updatedAt = "Just now";
    data.comments.forEach((comment) => {
      if (comment.storyId === story.id && comment.status === "active") {
        comment.status = "deleted";
        comment.deletionSource = "story";
      }
    });
    saveData();
    closeAppDialog();
    renderProfile();
    showToast("Chapter deleted. Its branch connection was preserved.");
  }

  function openAccountDataDialog() {
    openDialog({
      title: "Account data",
      subtitle: "Your story tree relationships are preserved if you leave.",
      body: `
        <p>Deleting the demo account removes the public content of every story you authored, all comments beneath those stories, and comments you wrote elsewhere.</p>
        <p>Descendant stories written by other members remain available, connected through deleted placeholders.</p>
      `,
      actions: `
        <button class="button button-secondary" type="button" data-action="close-dialog">Cancel</button>
        <button class="button button-danger" type="button" data-action="delete-account">Delete demo account data</button>
      `
    });
  }

  function deleteAccountData() {
    const user = currentUser();
    if (!user) return;
    const ownedStories = data.stories.filter((story) => story.authorId === user.id);
    const ownedIds = new Set(ownedStories.map((story) => story.id));
    const ownedDraftIds = new Set(ownedStories.filter((story) => story.status === "draft").map((story) => story.id));
    data.stories.forEach((story) => {
      if (ownedIds.has(story.id) && !ownedDraftIds.has(story.id)) {
        story.status = "deleted";
        story.deletionSource = "account";
        story.title = "Deleted chapter";
        story.deck = "";
        story.body = "";
        story.genre = "Unavailable";
        story.reportCount = 0;
        story.reportedBy = [];
        story.updatedAt = "Just now";
        story.authorId = null;
      }
      const likeIndex = story.likedBy.indexOf(user.id);
      if (likeIndex >= 0) {
        story.likedBy.splice(likeIndex, 1);
        story.likes = Math.max(0, story.likes - 1);
      }
    });
    data.stories = data.stories.filter((story) => !ownedDraftIds.has(story.id));
    data.comments = data.comments.filter((comment) => !ownedIds.has(comment.storyId) && comment.authorId !== user.id);
    data.comments.forEach((comment) => {
      const likeIndex = comment.likedBy.indexOf(user.id);
      if (likeIndex >= 0) {
        comment.likedBy.splice(likeIndex, 1);
        comment.likes = Math.max(0, comment.likes - 1);
      }
    });
    data.auditLog.push({ id: createId("audit"), action: "account_erased", actorId: null, storyId: null, createdAt: new Date().toISOString() });
    Object.entries(data.demoAuthProviders).forEach(([provider, userId]) => {
      if (userId === user.id) delete data.demoAuthProviders[provider];
    });
    Object.entries(preferredChildByParent).forEach(([parentId, childId]) => {
      if (ownedDraftIds.has(parentId) || ownedDraftIds.has(childId)) delete preferredChildByParent[parentId];
    });
    data.users = data.users.filter((candidate) => candidate.id !== user.id);
    data.notifications = data.notifications.filter((notification) => (
      notification.recipientId !== user.id
      && notification.actorId !== user.id
      && !ownedIds.has(notification.storyId)
      && !ownedIds.has(notification.targetStoryId)
    ));
    savePreferredBranches();
    saveData();
    session = { userId: null };
    saveSession();
    closeAppDialog();
    routeTo("story/s1");
    showToast("Demo account data deleted; story connections remain.");
  }

  function notificationLabel(notification) {
    if (notification.type === "continuation") return "continued your chapter";
    if (notification.type === "reply") return "replied to your comment";
    if (notification.type === "comment") return "commented on your chapter";
    if (notification.type === "comment_like") return "liked your comment";
    return "liked your chapter";
  }

  function filteredNotifications() {
    const notifications = notificationsForUser();
    if (inboxFilter === "all") return notifications;
    if (inboxFilter === "unread") return notifications.filter((item) => !item.read);
    if (inboxFilter === "like") return notifications.filter((item) => item.type === "like" || item.type === "comment_like");
    return notifications.filter((item) => item.type === inboxFilter);
  }

  function renderNotificationList() {
    const items = filteredNotifications();
    if (!items.length) return `<div class="empty-state"><div class="empty-state-icon">${icon("bell")}</div><h2>You're all caught up</h2><p>No notifications match this filter.</p></div>`;
    return `<ul class="notification-list">
      ${items.map((notification) => {
        const actor = userById(notification.actorId);
        const story = storyById(notification.storyId);
        const storyIsAvailable = story?.status === "active";
        return `
          <li class="notification-item ${notification.read ? "" : "unread"}" data-notification-id="${notification.id}" data-story-id="${notification.storyId}" tabindex="0" role="link">
            ${avatar(actor)}
            <div class="notification-copy">
              <p><strong>${escapeHTML(actor.name)}</strong> ${notificationLabel(notification)}${story ? ` in <strong>“${storyIsAvailable ? escapeHTML(story.title) : "an unavailable chapter"}”</strong>` : ""}.</p>
              ${notification.quote && storyIsAvailable ? `<p class="notification-quote">“${escapeHTML(notification.quote)}”</p>` : ""}
            </div>
            <span class="notification-time">${escapeHTML(notification.createdAt)}</span>
          </li>
        `;
      }).join("")}
    </ul>`;
  }

  function renderInbox() {
    const user = currentUser();
    if (!user) {
      renderAuthWall("Your inbox is waiting.", "Sign in to see replies, new continuations, comments, and likes.");
      return;
    }
    const userNotifications = notificationsForUser(user.id);
    const counts = {
      all: userNotifications.length,
      unread: userNotifications.filter((item) => !item.read).length,
      continuation: userNotifications.filter((item) => item.type === "continuation").length,
      reply: userNotifications.filter((item) => item.type === "reply").length,
      like: userNotifications.filter((item) => item.type === "like" || item.type === "comment_like").length
    };
    const filterButton = (id, label) => `<button class="inbox-filter ${inboxFilter === id ? "active" : ""}" type="button" data-inbox-filter="${id}" aria-pressed="${inboxFilter === id}"><span>${label}</span><span>${counts[id]}</span></button>`;
    main.innerHTML = `
      <div class="standard-page">
        <section class="page-hero">
          <div class="page-hero-inner page-hero-row">
            <div><p class="page-eyebrow">Your conversations</p><h1 class="page-title">Inbox</h1><p class="page-subtitle">New branches, thoughtful replies, and signs that your stories found someone.</p></div>
            <button class="button button-secondary" type="button" data-action="mark-all-read">${icon("check")} Mark all read</button>
          </div>
        </section>
        <div class="page-content">
          <div class="inbox-layout">
            <aside class="inbox-sidebar" aria-label="Inbox filters">
              ${filterButton("all", "All activity")}
              ${filterButton("unread", "Unread")}
              ${filterButton("continuation", "Continuations")}
              ${filterButton("reply", "Replies")}
              ${filterButton("like", "Likes")}
            </aside>
            <section class="inbox-main">
              <div class="inbox-main-header"><h2>${inboxFilter === "all" ? "All activity" : inboxFilter === "unread" ? "Unread" : `${formatStatus(inboxFilter)}s`}</h2><span class="status-badge active">${filteredNotifications().length} items</span></div>
              <div id="notification-list">${renderNotificationList()}</div>
            </section>
          </div>
        </div>
      </div>
    `;
  }

  function openNotification(notificationId) {
    const user = currentUser();
    const notification = data.notifications.find((item) => item.id === notificationId && item.recipientId === user?.id);
    if (!notification) return;
    notification.read = true;
    saveData();
    routeTo(`story/${notification.storyId}`);
  }

  function markAllNotificationsRead() {
    notificationsForUser().forEach((item) => { item.read = true; });
    saveData();
    renderInbox();
    renderHeader(getRoute());
    showToast("Everything is marked as read.");
  }

  function adminFilteredStories() {
    const query = (document.getElementById("admin-search")?.value || "").trim().toLowerCase();
    const status = document.getElementById("admin-status-filter")?.value || "all";
    return data.stories.filter((story) => {
      const author = userById(story.authorId);
      const matchesStatus = status === "all" || story.status === status;
      const matchesQuery = !query || story.title.toLowerCase().includes(query) || author.name.toLowerCase().includes(query) || story.id.toLowerCase().includes(query);
      return matchesStatus && matchesQuery;
    });
  }

  function renderAdminList() {
    const stories = adminFilteredStories();
    if (!stories.length) return `<div class="empty-state"><div class="empty-state-icon">${icon("search")}</div><h2>No matching chapters</h2><p>Try a different title, author, ID, or status.</p></div>`;
    return `<ul class="admin-list">
      ${stories.map((story) => {
        const author = userById(story.authorId);
        const restorable = (story.status === "reported" || story.status === "deleted") && story.deletionSource !== "account";
        return `
          <li class="admin-row">
            <div class="admin-story-cell"><strong>${escapeHTML(story.title)}</strong><span>${story.id} · Level ${getLevel(story)} · Updated ${escapeHTML(story.updatedAt)}</span></div>
            <div class="admin-author">${avatar(author, "sm")}<span>${escapeHTML(author.name)}</span></div>
            <span class="status-badge ${story.status}">${formatStatus(story.status)}</span>
            <span class="report-count" aria-label="${story.reportCount} reports">${story.reportCount}</span>
            <div class="admin-actions">
              <button class="button button-secondary button-small" type="button" data-admin-inspect="${story.id}">${icon("eye")} Inspect</button>
              ${restorable ? `<button class="button button-primary button-small" type="button" data-admin-restore="${story.id}">${icon("refresh")} Restore</button>` : story.deletionSource === "account" ? `<span class="status-badge deleted">Permanently erased</span>` : story.status === "active" ? `<button class="icon-button" type="button" data-admin-hide="${story.id}" aria-label="Hide ${escapeHTML(story.title)}">${icon("flag")}</button>` : ""}
            </div>
          </li>
        `;
      }).join("")}
    </ul>`;
  }

  function renderAdmin() {
    const user = currentUser();
    if (!user) {
      renderAuthWall("Administrator access", "Sign in with the administrator account to review reports and restore chapters.");
      return;
    }
    if (user.role !== "admin") {
      main.innerHTML = `<div class="auth-wall"><div class="auth-wall-card"><div class="auth-mark">${icon("lock")}</div><h1>Administrator access only</h1><p>Your account does not have permission to open moderation tools.</p><a class="button button-primary" href="#story/s1">Return to stories</a></div></div>`;
      return;
    }

    const activeCount = data.stories.filter((story) => story.status === "active").length;
    const reportedCount = data.stories.filter((story) => story.status === "reported").length;
    const deletedCount = data.stories.filter((story) => story.status === "deleted").length;
    const totalReports = data.stories.reduce((sum, story) => sum + story.reportCount, 0);

    main.innerHTML = `
      <div class="standard-page">
        <section class="page-hero">
          <div class="page-hero-inner page-hero-row">
            <div><p class="page-eyebrow">Administrator workspace</p><h1 class="page-title">Story moderation</h1><p class="page-subtitle">Review community reports, inspect hidden content, and restore chapters without breaking their story trees.</p></div>
            <span class="status-badge active">${icon("shield")} Admin access</span>
          </div>
        </section>
        <div class="page-content">
          <section class="admin-summary-grid" aria-label="Moderation summary">
            <div class="summary-card"><div class="summary-card-label"><span>Active chapters</span><span class="summary-card-icon">${icon("book")}</span></div><strong>${activeCount}</strong></div>
            <div class="summary-card"><div class="summary-card-label"><span>Under review</span><span class="summary-card-icon alert">${icon("flag")}</span></div><strong>${reportedCount}</strong></div>
            <div class="summary-card"><div class="summary-card-label"><span>Deleted</span><span class="summary-card-icon">${icon("trash")}</span></div><strong>${deletedCount}</strong></div>
            <div class="summary-card"><div class="summary-card-label"><span>Total reports</span><span class="summary-card-icon alert">${icon("alert")}</span></div><strong>${totalReports}</strong></div>
          </section>

          <section class="admin-panel">
            <div class="admin-toolbar">
              <div class="search-field">${icon("search")}<label class="sr-only" for="admin-search">Search chapters</label><input id="admin-search" type="search" placeholder="Search title, author, or story ID…"></div>
              <label class="sr-only" for="admin-status-filter">Filter by status</label>
              <select class="select-input" id="admin-status-filter">
                <option value="all">All statuses</option>
                <option value="reported">Under review</option>
                <option value="deleted">Deleted</option>
                <option value="active">Active</option>
                <option value="draft">Drafts</option>
              </select>
            </div>
            <div class="admin-list-header"><span>Chapter</span><span>Author</span><span>Status</span><span>Reports</span><span style="text-align:right">Actions</span></div>
            <div id="admin-list-body">${renderAdminList()}</div>
          </section>
          <p class="audit-note">${icon("info")} Restoring or hiding a chapter creates a local audit event in this prototype. Public readers never see report totals or hidden content.</p>
        </div>
      </div>
    `;
  }

  function inspectStory(storyId) {
    const story = storyById(storyId);
    if (!story || currentUser()?.role !== "admin") return;
    const author = userById(story.authorId);
    const restorable = (story.status === "reported" || story.status === "deleted") && story.deletionSource !== "account";
    openDialog({
      title: "Inspect chapter",
      subtitle: `${story.id} · ${formatStatus(story.status)}`,
      wide: true,
      body: `
        <div class="inspection-story"><h3>${escapeHTML(story.title)}</h3><p>${escapeHTML(story.body || (story.deletionSource === "account" ? "Content permanently erased with the author's account." : "No content available."))}</p></div>
        <div class="metadata-grid">
          <div class="metadata-item"><span>Author</span><strong>${escapeHTML(author.name)}</strong></div>
          <div class="metadata-item"><span>Reports</span><strong>${story.reportCount} distinct reports</strong></div>
          <div class="metadata-item"><span>Tree position</span><strong>Level ${getLevel(story)} · ${childrenOf(story.id).length} direct children</strong></div>
          <div class="metadata-item"><span>Last updated</span><strong>${escapeHTML(story.updatedAt)}</strong></div>
        </div>
      `,
      actions: `
        <button class="button button-secondary" type="button" data-story-id="${story.id}" data-action="view-from-admin">View in tree</button>
        ${restorable ? `<button class="button button-primary" type="button" data-admin-restore="${story.id}">${icon("refresh")} Restore chapter</button>` : story.status === "active" ? `<button class="button button-danger" type="button" data-admin-hide="${story.id}">${icon("flag")} Hide chapter</button>` : ""}
      `
    });
  }

  function restoreStory(storyId) {
    const story = storyById(storyId);
    if (!story || currentUser()?.role !== "admin" || !["reported", "deleted"].includes(story.status)) return;
    if (story.deletionSource === "account") {
      showToast("Account-erased content cannot be restored.", "info");
      return;
    }
    const previousStatus = story.status;
    story.status = "active";
    story.deletionSource = null;
    story.reportCount = 0;
    story.reportedBy = [];
    story.updatedAt = "Just now";
    data.comments.forEach((comment) => {
      if (comment.storyId === story.id && comment.status === "deleted" && comment.deletionSource === "story") {
        comment.status = "active";
        comment.deletionSource = null;
      }
    });
    recordAudit("story_restored", story, previousStatus);
    saveData();
    closeAppDialog();
    renderApp();
    showToast(`“${story.title}” was restored.`);
  }

  function confirmAdminHide(storyId) {
    const story = storyById(storyId);
    if (!story || currentUser()?.role !== "admin" || story.status !== "active") return;
    openDialog({
      title: "Hide this chapter?",
      subtitle: "Its descendants will remain accessible through a placeholder.",
      body: `<p>Hide <strong>“${escapeHTML(story.title)}”</strong> from public view and mark it as under review?</p>`,
      actions: `<button class="button button-secondary" type="button" data-action="close-dialog">Cancel</button><button class="button button-danger" type="button" data-action="confirm-admin-hide" data-story-id="${story.id}">${icon("flag")} Hide chapter</button>`
    });
  }

  function adminHide(storyId) {
    const story = storyById(storyId);
    if (!story || currentUser()?.role !== "admin" || story.status !== "active") return;
    const previousStatus = story.status;
    story.status = "reported";
    story.deletionSource = "moderation";
    story.reportCount = Math.max(4, story.reportCount);
    story.updatedAt = "Just now";
    recordAudit("story_hidden", story, previousStatus);
    saveData();
    closeAppDialog();
    renderApp();
    showToast("Chapter hidden for review; the branch is still connected.");
  }

  function renderSearchResults(query = "") {
    const list = document.getElementById("search-results");
    if (!list) return;
    const normalized = query.trim().toLowerCase();
    const matches = data.stories
      .filter((story) => story.status !== "draft")
      .filter((story) => {
        if (!normalized) return true;
        if (story.status !== "active") return ["unavailable", "reported", "deleted", "chapter"].some((term) => term.includes(normalized));
        return story.title.toLowerCase().includes(normalized)
          || story.genre.toLowerCase().includes(normalized)
          || userById(story.authorId).name.toLowerCase().includes(normalized);
      })
      .slice(0, 7);
    list.innerHTML = matches.length ? matches.map((story) => `
      <li>
        <button class="search-result-button" type="button" data-story-id="${story.id}">
          <span class="search-result-copy"><strong>${escapeHTML(story.status === "active" ? story.title : story.status === "reported" ? "Reported chapter" : "Deleted chapter")}</strong><span>${story.status === "active" ? `${escapeHTML(userById(story.authorId).name)} · ${escapeHTML(story.genre)}` : "Content unavailable · branch preserved"}</span></span>
          <span class="level-tag">Level ${getLevel(story)}</span>
        </button>
      </li>
    `).join("") : `<li class="empty-comments" style="padding:35px 15px">No stories found.</li>`;
  }

  function openSearch() {
    openDialog({
      title: "Find a story",
      subtitle: "Search by title, writer, or genre.",
      body: `
        <div class="search-field">${icon("search")}<label class="sr-only" for="global-search">Search stories</label><input id="global-search" type="search" placeholder="Try “lighthouse” or “mystery”…" autocomplete="off"></div>
        <ul class="search-results" id="search-results"></ul>
      `,
      onReady: () => {
        renderSearchResults();
        document.getElementById("global-search")?.focus();
      }
    });
  }

  function resetDemoData() {
    if (currentUser()?.role !== "admin") return;
    data = cloneData(initialData);
    preferredChildByParent = {};
    saveData();
    savePreferredBranches();
    closeAppDialog();
    renderApp();
    showToast("Demo stories and moderation states were reset.");
  }

  function cloneData(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function signOut() {
    session = { userId: null };
    saveSession();
    closeAppDialog();
    renderApp();
    showToast("Signed out. You can keep reading as a guest.");
  }

  document.addEventListener("click", (event) => {
    const oauth = event.target.closest("[data-oauth]");
    if (oauth) {
      event.preventDefault();
      signIn(oauth.dataset.oauth);
      return;
    }

    const storyNav = event.target.closest("[data-story-nav]");
    if (storyNav) {
      event.preventDefault();
      if (!storyNav.disabled) navigateStory(storyNav.dataset.storyNav);
      return;
    }

    const branchChoice = event.target.closest("[data-choose-branch]");
    if (branchChoice) {
      event.preventDefault();
      selectAndOpenChild(branchChoice.dataset.parentId, branchChoice.dataset.chooseBranch);
      return;
    }

    const selectedChild = event.target.closest("[data-select-child]");
    if (selectedChild) {
      event.preventDefault();
      preferredChildByParent[selectedChild.dataset.parentId] = selectedChild.dataset.selectChild;
      savePreferredBranches();
      routeTo(`story/${selectedChild.dataset.selectChild}`);
      return;
    }

    const commentLike = event.target.closest("[data-comment-like]");
    if (commentLike) {
      event.preventDefault();
      toggleCommentLike(commentLike.dataset.commentLike);
      return;
    }

    const commentReply = event.target.closest("[data-comment-reply]");
    if (commentReply) {
      event.preventDefault();
      beginReply(commentReply.dataset.commentReply);
      return;
    }

    const toggleReplies = event.target.closest("[data-toggle-replies]");
    if (toggleReplies) {
      event.preventDefault();
      const id = toggleReplies.dataset.toggleReplies;
      if (expandedReplyThreads.has(id)) expandedReplyThreads.delete(id);
      else expandedReplyThreads.add(id);
      refreshComments();
      return;
    }

    const profileTab = event.target.closest("[data-profile-filter]");
    if (profileTab) {
      event.preventDefault();
      profileFilter = profileTab.dataset.profileFilter;
      renderProfile();
      requestAnimationFrame(() => document.getElementById(`profile-tab-${profileFilter}`)?.focus());
      return;
    }

    const inboxTab = event.target.closest("[data-inbox-filter]");
    if (inboxTab) {
      event.preventDefault();
      inboxFilter = inboxTab.dataset.inboxFilter;
      renderInbox();
      return;
    }

    const notification = event.target.closest("[data-notification-id]");
    if (notification) {
      event.preventDefault();
      openNotification(notification.dataset.notificationId);
      return;
    }

    const deleteButton = event.target.closest("[data-delete-story]");
    if (deleteButton) {
      event.preventDefault();
      confirmDeleteStory(deleteButton.dataset.deleteStory);
      return;
    }

    const inspectButton = event.target.closest("[data-admin-inspect]");
    if (inspectButton) {
      event.preventDefault();
      inspectStory(inspectButton.dataset.adminInspect);
      return;
    }

    const restoreButton = event.target.closest("[data-admin-restore]");
    if (restoreButton) {
      event.preventDefault();
      restoreStory(restoreButton.dataset.adminRestore);
      return;
    }

    const hideButton = event.target.closest("[data-admin-hide]");
    if (hideButton) {
      event.preventDefault();
      confirmAdminHide(hideButton.dataset.adminHide);
      return;
    }

    const actionTarget = event.target.closest("[data-action]");
    if (actionTarget) {
      const action = actionTarget.dataset.action;
      const storyId = actionTarget.dataset.storyId;
      if (!(action === "close-dialog" && actionTarget.tagName === "A")) event.preventDefault();
      switch (action) {
        case "sign-in": openAuthModal("Sign in to write, react, comment, and report."); break;
        case "sign-in-route": openAuthModal("Sign in to open this member page."); break;
        case "user-menu": openUserMenu(); break;
        case "open-inbox": routeTo("inbox"); break;
        case "search": openSearch(); break;
        case "close-dialog": closeAppDialog(); break;
        case "sign-out": signOut(); break;
        case "reset-demo": resetDemoData(); break;
        case "about": openInfoDialog("about"); break;
        case "community-guidelines": openInfoDialog("guidelines"); break;
        case "start-story": requireAuth(() => routeTo("write/start"), "Sign in to start a new story."); break;
        case "continue-story": requireAuth(() => routeTo(`write/continue/${storyId}`), "Sign in to continue this story."); break;
        case "like-story": requireAuth(() => toggleStoryLike(storyId), "Sign in to like this chapter."); break;
        case "open-comments": openComments(storyId); break;
        case "share-story": openShareDialog(storyId); break;
        case "report-story": requireAuth(() => openReportDialog(storyId), "Sign in before reporting a chapter."); break;
        case "confirm-report": confirmReport(storyId); break;
        case "pick-branch": openBranchPicker(storyId); break;
        case "copy-share-link": copyShareLink(); break;
        case "native-share": {
          nativeShare(storyId);
          break;
        }
        case "close-comments": closeComments(); break;
        case "comment-sign-in": {
          const returnStoryId = activeCommentsStoryId;
          if (commentsDialog.open) commentsDialog.close();
          document.body.classList.remove("dialog-open");
          openAuthModal("Sign in to join this conversation.", () => openComments(returnStoryId));
          break;
        }
        case "save-draft": saveStoryFromEditor(true); break;
        case "preview-draft": previewDraft(); break;
        case "account-data": openAccountDataDialog(); break;
        case "confirm-delete-story": deleteStory(storyId); break;
        case "delete-account": deleteAccountData(); break;
        case "mark-all-read": markAllNotificationsRead(); break;
        case "view-from-admin": closeAppDialog(); routeTo(`story/${storyId}`); break;
        case "confirm-admin-hide": adminHide(storyId); break;
        default: break;
      }
      return;
    }

    const storyTarget = event.target.closest("[data-story-id]");
    if (storyTarget) {
      event.preventDefault();
      closeAppDialog();
      routeTo(`story/${storyTarget.dataset.storyId}`);
    }
  });

  document.addEventListener("submit", (event) => {
    if (event.target.id === "story-editor") {
      event.preventDefault();
      saveStoryFromEditor(false);
      return;
    }
    if (event.target.id === "comment-form") {
      event.preventDefault();
      addComment(activeCommentsStoryId, new FormData(event.target).get("comment") || "");
      return;
    }
    if (event.target.matches(".inline-reply-form")) {
      event.preventDefault();
      addReply(event.target.dataset.rootCommentId, event.target.dataset.replyToId, new FormData(event.target).get("reply") || "");
    }
  });

  document.addEventListener("input", (event) => {
    if (event.target.id === "global-search") {
      renderSearchResults(event.target.value);
      return;
    }
    if (event.target.id === "admin-search") {
      const list = document.getElementById("admin-list-body");
      if (list) list.innerHTML = renderAdminList();
      return;
    }
    if (event.target.id === "story-title-input") {
      const count = document.getElementById("title-count");
      if (count) count.textContent = `${event.target.value.length}/80`;
    }
    if (event.target.id === "story-deck-input") {
      const count = document.getElementById("deck-count");
      if (count) count.textContent = `${event.target.value.length}/140`;
    }
    if (event.target.id === "story-body-input") {
      const count = document.getElementById("word-count");
      if (count) count.textContent = `${wordCount(event.target.value)} words`;
    }
    if (event.target.closest("#story-editor")) {
      const state = document.getElementById("save-state");
      if (state) state.innerHTML = '<span class="save-state-dot" style="background:#d29654"></span>Unsaved changes';
    }
  });

  document.addEventListener("change", (event) => {
    if (event.target.id === "admin-status-filter") {
      const list = document.getElementById("admin-list-body");
      if (list) list.innerHTML = renderAdminList();
    }
  });

  document.addEventListener("keydown", (event) => {
    const notification = event.target.closest?.("[data-notification-id]");
    const storyLink = event.target.closest?.('[role="link"][data-story-id]');
    if ((notification || storyLink) && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      event.target.closest(notification ? "[data-notification-id]" : '[role="link"][data-story-id]')?.click();
      return;
    }

    const activeProfileTab = event.target.closest?.('[role="tab"][data-profile-filter]');
    if (activeProfileTab && ["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
      event.preventDefault();
      const filters = ["stories", "drafts", "liked"];
      const currentIndex = filters.indexOf(activeProfileTab.dataset.profileFilter);
      let nextIndex = currentIndex;
      if (event.key === "ArrowLeft") nextIndex = (currentIndex - 1 + filters.length) % filters.length;
      if (event.key === "ArrowRight") nextIndex = (currentIndex + 1) % filters.length;
      if (event.key === "Home") nextIndex = 0;
      if (event.key === "End") nextIndex = filters.length - 1;
      profileFilter = filters[nextIndex];
      renderProfile();
      requestAnimationFrame(() => document.getElementById(`profile-tab-${profileFilter}`)?.focus());
      return;
    }

    if (getRoute().name !== "reader" || appDialog.open || commentsDialog.open) return;
    if (event.target.matches("input, textarea, select, button, a")) return;
    const card = document.getElementById("story-card");
    if (!card || (document.activeElement !== document.body && document.activeElement !== card)) return;
    const directions = { ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down" };
    if (directions[event.key]) {
      event.preventDefault();
      navigateStory(directions[event.key]);
    }
  });

  appDialog.addEventListener("cancel", () => {
    appDialog.classList.remove("wide-dialog");
    if (!commentsDialog.open) document.body.classList.remove("dialog-open");
  });

  appDialog.addEventListener("close", () => {
    appDialog.classList.remove("wide-dialog");
    if (!commentsDialog.open) document.body.classList.remove("dialog-open");
  });

  commentsDialog.addEventListener("cancel", () => {
    activeCommentsStoryId = null;
    replyTargetId = null;
    if (!appDialog.open) document.body.classList.remove("dialog-open");
  });

  commentsDialog.addEventListener("close", () => {
    commentsDialog.replaceChildren();
    activeCommentsStoryId = null;
    replyTargetId = null;
    if (!appDialog.open) document.body.classList.remove("dialog-open");
  });

  window.addEventListener("hashchange", () => {
    if (commentsDialog.open) closeComments();
    if (appDialog.open) closeAppDialog();
    renderApp();
    window.scrollTo({ top: 0, behavior: "instant" });
    requestAnimationFrame(() => {
      const focusTarget = getRoute().name === "reader" ? document.getElementById("story-card") : main;
      focusTarget?.focus({ preventScroll: true });
    });
  });

  if (!location.hash) history.replaceState(null, "", "#story/s1");
  renderApp();
})();
