class De extends te.X {
    constructor(e) {
      var t, n, r;
      super(),
        (0, o.A)(this, "logger", void 0),
        (0, o.A)(this, "reEmitter", new y.Q(this)),
        (0, o.A)(this, "olmVersion", null),
        (0, o.A)(this, "usingExternalCrypto", !1),
        (0, o.A)(this, "_store", void 0),
        (0, o.A)(this, "deviceId", void 0),
        (0, o.A)(this, "credentials", void 0),
        (0, o.A)(this, "pickleKey", void 0),
        (0, o.A)(this, "scheduler", void 0),
        (0, o.A)(this, "clientRunning", !1),
        (0, o.A)(this, "timelineSupport", !1),
        (0, o.A)(this, "urlPreviewCache", {}),
        (0, o.A)(this, "identityServer", void 0),
        (0, o.A)(this, "http", void 0),
        (0, o.A)(this, "crypto", void 0),
        (0, o.A)(this, "cryptoBackend", void 0),
        (0, o.A)(this, "cryptoCallbacks", void 0),
        (0, o.A)(this, "callEventHandler", void 0),
        (0, o.A)(this, "groupCallEventHandler", void 0),
        (0, o.A)(this, "supportsCallTransfer", !1),
        (0, o.A)(this, "forceTURN", !1),
        (0, o.A)(this, "iceCandidatePoolSize", 0),
        (0, o.A)(this, "idBaseUrl", void 0),
        (0, o.A)(this, "baseUrl", void 0),
        (0, o.A)(this, "isVoipWithNoMediaAllowed", void 0),
        (0, o.A)(this, "useLivekitForGroupCalls", void 0),
        (0, o.A)(this, "canSupportVoip", !1),
        (0, o.A)(this, "peekSync", null),
        (0, o.A)(this, "isGuestAccount", !1),
        (0, o.A)(this, "ongoingScrollbacks", {}),
        (0, o.A)(this, "notifTimelineSet", null),
        (0, o.A)(this, "cryptoStore", void 0),
        (0, o.A)(this, "verificationMethods", void 0),
        (0, o.A)(this, "fallbackICEServerAllowed", !1),
        (0, o.A)(this, "syncApi", void 0),
        (0, o.A)(this, "roomNameGenerator", void 0),
        (0, o.A)(this, "pushRules", void 0),
        (0, o.A)(this, "syncLeftRoomsPromise", void 0),
        (0, o.A)(this, "syncedLeftRooms", !1),
        (0, o.A)(this, "clientOpts", void 0),
        (0, o.A)(this, "clientWellKnownIntervalID", void 0),
        (0, o.A)(this, "canResetTimelineCallback", void 0),
        (0, o.A)(this, "canSupport", new Map()),
        (0, o.A)(this, "pushProcessor", new p.j(this)),
        (0, o.A)(this, "serverVersionsPromise", void 0),
        (0, o.A)(this, "cachedCapabilities", void 0),
        (0, o.A)(this, "clientWellKnown", void 0),
        (0, o.A)(this, "clientWellKnownPromise", void 0),
        (0, o.A)(this, "turnServers", []),
        (0, o.A)(this, "turnServersExpiry", 0),
        (0, o.A)(this, "checkTurnServersIntervalID", void 0),
        (0, o.A)(this, "exportedOlmDeviceToImport", void 0),
        (0, o.A)(this, "txnCtr", 0),
        (0, o.A)(this, "mediaHandler", new ee.L(this)),
        (0, o.A)(this, "sessionId", void 0),
        (0, o.A)(this, "eventsBeingEncrypted", new Set()),
        (0, o.A)(this, "useE2eForGroupCall", !0),
        (0, o.A)(this, "toDeviceMessageQueue", void 0),
        (0, o.A)(this, "livekitServiceURL", void 0),
        (0, o.A)(this, "_secretStorage", void 0),
        (0, o.A)(this, "ignoredInvites", void 0),
        (0, o.A)(this, "matrixRTC", void 0),
        (0, o.A)(this, "startCallEventHandler", () => {
          this.isInitialSyncComplete() &&
            ((0, l.sj)() &&
              (this.callEventHandler.start(),
              this.groupCallEventHandler.start()),
            this.off(Ae.Sync, this.startCallEventHandler));
        }),
        (0, o.A)(this, "startMatrixRTC", () => {
          this.isInitialSyncComplete() &&
            (this.matrixRTC.start(),
            this.off(Ae.Sync, this.startMatrixRTC));
        }),
        (0, o.A)(this, "fixupRoomNotifications", () => {
          if (this.isInitialSyncComplete()) {
            var e;
            const t = (
              null !== (e = this.getRooms()) && void 0 !== e ? e : []
            ).filter((e) => e.getUnreadNotificationCount(R.X5.Total) > 0);
            for (const e of t) {
              const t = this.getSafeUserId();
              e.fixupNotifications(t);
            }
            this.off(Ae.Sync, this.fixupRoomNotifications);
          }
        }),
        (this.logger = null !== (t = e.logger) && void 0 !== t ? t : _.v),
        (e.baseUrl = m.hc(e.baseUrl)),
        (e.idBaseUrl = m.hc(e.idBaseUrl)),
        (this.baseUrl = e.baseUrl),
        (this.idBaseUrl = e.idBaseUrl),
        (this.identityServer = e.identityServer),
        (this.usingExternalCrypto =
          null !== (n = e.usingExternalCrypto) && void 0 !== n && n),
        (this.store = e.store || new a()),
        (this.deviceId = e.deviceId || null),
        (this.sessionId = (0, N.DU)(10));
      const i = e.userId || null;
      (this.credentials = { userId: i }),
        (this.http = new E.ED(this, {
          fetchFn: e.fetchFn,
          baseUrl: e.baseUrl,
          idBaseUrl: e.idBaseUrl,
          accessToken: e.accessToken,
          refreshToken: e.refreshToken,
          tokenRefreshFunction: e.tokenRefreshFunction,
          prefix: E.iD.V3,
          onlyData: !0,
          extraParams: e.queryParams,
          localTimeoutMs: e.localTimeoutMs,
          useAuthorizationHeader: e.useAuthorizationHeader,
          logger: this.logger,
        })),
        e.deviceToImport
          ? this.deviceId
            ? this.logger.warn(
                "not importing device because device ID is provided to constructor independently of exported data"
              )
            : this.credentials.userId
            ? this.logger.warn(
                "not importing device because user ID is provided to constructor independently of exported data"
              )
            : e.deviceToImport.deviceId
            ? ((this.deviceId = e.deviceToImport.deviceId),
              (this.credentials.userId = e.deviceToImport.userId),
              (this.exportedOlmDeviceToImport =
                e.deviceToImport.olmDevice))
            : this.logger.warn(
                "not importing device because no device ID in exported data"
              )
          : e.pickleKey && (this.pickleKey = e.pickleKey),
        (this.useLivekitForGroupCalls = Boolean(
          e.useLivekitForGroupCalls
        )),
        (this.scheduler = e.scheduler),
        this.scheduler &&
          this.scheduler.setProcessFunction(async (e) => {
            const t = this.getRoom(e.getRoomId());
            e.status !== s.fb.SENDING &&
              this.updatePendingEventStatus(t, e, s.fb.SENDING);
            const n = await this.sendEventHttpRequest(e);
            return t && t.updatePendingEvent(e, s.fb.SENT, n.event_id), n;
          }),
        (0, l.sj)() &&
          ((this.callEventHandler = new d.N(this)),
          (this.groupCallEventHandler = new u.e(this)),
          (this.canSupportVoip = !0),
          this.on(Ae.Sync, this.startCallEventHandler)),
        (this.matrixRTC = new he.I(this)),
        this.on(Ae.Sync, this.fixupRoomNotifications),
        (this.timelineSupport = Boolean(e.timelineSupport)),
        (this.cryptoStore = e.cryptoStore),
        (this.verificationMethods = e.verificationMethods),
        (this.cryptoCallbacks = e.cryptoCallbacks || {}),
        (this.forceTURN = e.forceTURN || !1),
        (this.iceCandidatePoolSize =
          void 0 === e.iceCandidatePoolSize ? 0 : e.iceCandidatePoolSize),
        (this.supportsCallTransfer = e.supportsCallTransfer || !1),
        (this.fallbackICEServerAllowed =
          e.fallbackICEServerAllowed || !1),
        (this.isVoipWithNoMediaAllowed =
          e.isVoipWithNoMediaAllowed || !1),
        void 0 !== e.useE2eForGroupCall &&
          (this.useE2eForGroupCall = e.useE2eForGroupCall),
        (this.livekitServiceURL = e.livekitServiceURL),
        (this.roomNameGenerator = e.roomNameGenerator),
        (this.toDeviceMessageQueue = new le(this)),
        this.on(s.OQ.Decrypted, (e) => {
          Re(this, e);
        }),
        (this.ignoredInvites = new ce.bp(this)),
        (this._secretStorage = new me.ServerSideSecretStorageImpl(
          this,
          null !== (r = e.cryptoCallbacks) && void 0 !== r ? r : {}
        )),
        this.setMaxListeners(0);
    }
    set store(e) {
      (this._store = e),
        this._store.setUserCreator((e) => F.K.createUser(e, this));
    }
    get store() {
      return this._store;
    }
    async startClient(e) {
      if (this.clientRunning) return;
      (this.clientRunning = !0), this.on(Ae.Sync, this.startMatrixRTC);
      const t = this.getUserId();
      t && this.store.storeUser(new F.K(t)),
        this.canSupportVoip &&
          ((this.checkTurnServersIntervalID = setInterval(() => {
            this.checkTurnServers();
          }, _e)),
          this.checkTurnServers()),
        this.syncApi &&
          (this.logger.error(
            "Still have sync object whilst not running: stopping old one"
          ),
          this.syncApi.stop());
      try {
        await this.getVersions();
        const {
          threads: e,
          list: t,
          fwdPagination: n,
        } = await this.doesServerSupportThread();
        oe.jV.setServerSideSupport(e),
          oe.jV.setServerSideListSupport(t),
          oe.jV.setServerSideFwdPaginationSupport(n);
      } catch (e) {
        this.logger.error(
          "Can't fetch server versions, continuing to initialise sync, this will be retried later",
          e
        );
      }
      (this.clientOpts = null != e ? e : {}),
        this.clientOpts.slidingSync
          ? (this.syncApi = new re.m(
              this.clientOpts.slidingSync,
              this,
              this.clientOpts,
              this.buildSyncApiOptions()
            ))
          : (this.syncApi = new i.w_(
              this,
              this.clientOpts,
              this.buildSyncApiOptions()
            )),
        this.syncApi
          .sync()
          .catch((e) =>
            this.logger.info("Sync startup aborted with an error:", e)
          ),
        void 0 !== this.clientOpts.clientWellKnownPollPeriod &&
          ((this.clientWellKnownIntervalID = setInterval(() => {
            this.fetchClientWellKnown();
          }, 1e3 * this.clientOpts.clientWellKnownPollPeriod)),
          this.fetchClientWellKnown()),
        this.toDeviceMessageQueue.start();
    }
    buildSyncApiOptions() {
      return {
        crypto: this.crypto,
        cryptoCallbacks: this.cryptoBackend,
        canResetEntireTimeline: (e) =>
          !!this.canResetTimelineCallback &&
          this.canResetTimelineCallback(e),
      };
    }
    stopClient() {
      var e, t, r, o, i;
      null === (e = this.cryptoBackend) || void 0 === e || e.stop(),
        this.off(Ae.Sync, this.startMatrixRTC),
        this.clientRunning &&
          (this.logger.debug("stopping MatrixClient"),
          (this.clientRunning = !1),
          null === (t = this.syncApi) || void 0 === t || t.stop(),
          (this.syncApi = void 0),
          null === (r = this.peekSync) || void 0 === r || r.stopPeeking(),
          null === (o = this.callEventHandler) ||
            void 0 === o ||
            o.stop(),
          null === (i = this.groupCallEventHandler) ||
            void 0 === i ||
            i.stop(),
          (this.callEventHandler = void 0),
          (this.groupCallEventHandler = void 0),
          n.g.clearInterval(this.checkTurnServersIntervalID),
          (this.checkTurnServersIntervalID = void 0),
          void 0 !== this.clientWellKnownIntervalID &&
            n.g.clearInterval(this.clientWellKnownIntervalID),
          this.toDeviceMessageQueue.stop(),
          this.matrixRTC.stop());
    }
    async rehydrateDevice() {
      if (this.crypto)
        throw new Error(
          "Cannot rehydrate device after crypto is initialized"
        );
      if (!this.cryptoCallbacks.getDehydrationKey) return;
      const e = await this.getDehydratedDevice();
      if (!e) return;
      if (!e.device_data || !e.device_id)
        return void this.logger.info("no dehydrated device found");
      const t = new n.g.Olm.Account();
      try {
        const n = e.device_data;
        if (n.algorithm !== A.S)
          return void this.logger.warn(
            "Wrong algorithm for dehydrated device"
          );
        this.logger.debug("unpickling dehydrated device");
        const r = await this.cryptoCallbacks.getDehydrationKey(n, (e) => {
          t.unpickle(new Uint8Array(e), n.account);
        });
        t.unpickle(r, n.account), this.logger.debug("unpickled device");
        if (
          (
            await this.http.authedRequest(
              E.IT.Post,
              "/dehydrated_device/claim",
              void 0,
              { device_id: e.device_id },
              { prefix: "/_matrix/client/unstable/org.matrix.msc2697.v2" }
            )
          ).success
        ) {
          (this.deviceId = e.device_id),
            this.logger.info("using dehydrated device");
          const n = this.pickleKey || "DEFAULT_KEY";
          return (
            (this.exportedOlmDeviceToImport = {
              pickledAccount: t.pickle(n),
              sessions: [],
              pickleKey: n,
            }),
            t.free(),
            this.deviceId
          );
        }
        return (
          t.free(), void this.logger.info("not using dehydrated device")
        );
      } catch (e) {
        t.free(), this.logger.warn("could not unpickle", e);
      }
    }
    async getDehydratedDevice() {
      try {
        return await this.http.authedRequest(
          E.IT.Get,
          "/dehydrated_device",
          void 0,
          void 0,
          { prefix: "/_matrix/client/unstable/org.matrix.msc2697.v2" }
        );
      } catch (e) {
        return void this.logger.info(
          "could not get dehydrated device",
          e
        );
      }
    }
    async setDehydrationKey(e, t, n) {
      if (this.crypto)
        return this.crypto.dehydrationManager.setKeyAndQueueDehydration(
          e,
          t,
          n
        );
      this.logger.warn("not dehydrating device if crypto is not enabled");
    }
    async createDehydratedDevice(e, t, n) {
      if (this.crypto)
        return (
          await this.crypto.dehydrationManager.setKey(e, t, n),
          this.crypto.dehydrationManager.dehydrateDevice()
        );
      this.logger.warn("not dehydrating device if crypto is not enabled");
    }
    async exportDevice() {
      if (this.crypto)
        return {
          userId: this.credentials.userId,
          deviceId: this.deviceId,
          olmDevice: await this.crypto.olmDevice.export(),
        };
      this.logger.warn("not exporting device if crypto is not enabled");
    }
    clearStores() {
      if (this.clientRunning)
        throw new Error("Cannot clear stores while client is running");
      const e = [];
      e.push(this.store.deleteAllData()),
        this.cryptoStore && e.push(this.cryptoStore.deleteAllData());
      return (
        e.push(
          (async () => {
            let e;
            try {
              if (((e = n.g.indexedDB), !e)) return;
            } catch (e) {
              return;
            }
            for (const t of [
              `${ue}::matrix-sdk-crypto`,
              `${ue}::matrix-sdk-crypto-meta`,
            ]) {
              const n = new Promise((n, r) => {
                this.logger.info(`Removing IndexedDB instance ${t}`);
                const o = e.deleteDatabase(t);
                (o.onsuccess = (e) => {
                  this.logger.info(`Removed IndexedDB instance ${t}`),
                    n(0);
                }),
                  (o.onerror = (e) => {
                    this.logger.warn(
                      `Failed to remove IndexedDB instance ${t}:`,
                      e
                    ),
                      n(0);
                  }),
                  (o.onblocked = (e) => {
                    this.logger.info(
                      `cannot yet remove IndexedDB instance ${t}`
                    );
                  });
              });
              await n;
            }
          })()
        ),
        Promise.all(e).then()
      );
    }
    getUserId() {
      return this.credentials && this.credentials.userId
        ? this.credentials.userId
        : null;
    }
    getSafeUserId() {
      const e = this.getUserId();
      if (!e) throw new Error("Expected logged in user but found none.");
      return e;
    }
    getDomain() {
      return this.credentials && this.credentials.userId
        ? this.credentials.userId.replace(/^.*?:/, "")
        : null;
    }
    getUserIdLocalpart() {
      return this.credentials && this.credentials.userId
        ? this.credentials.userId.split(":")[0].substring(1)
        : null;
    }
    getDeviceId() {
      return this.deviceId;
    }
    getSessionId() {
      return this.sessionId;
    }
    supportsVoip() {
      return this.canSupportVoip;
    }
    getMediaHandler() {
      return this.mediaHandler;
    }
    setForceTURN(e) {
      this.forceTURN = e;
    }
    setSupportsCallTransfer(e) {
      this.supportsCallTransfer = e;
    }
    getUseE2eForGroupCall() {
      return this.useE2eForGroupCall;
    }
    createCall(e) {
      return (0, l.sv)(this, e);
    }
    async createGroupCall(e, t, n, r, o, i) {
      if (this.getGroupCallForRoom(e))
        throw new Error(`${e} already has an existing group call`);
      const s = this.getRoom(e);
      if (!s) throw new Error(`Cannot find room ${e}`);
      return new Q.eO(
        this,
        s,
        t,
        n,
        r,
        void 0,
        o || this.isVoipWithNoMediaAllowed,
        i,
        this.isVoipWithNoMediaAllowed,
        this.useLivekitForGroupCalls,
        this.livekitServiceURL
      ).create();
    }
    getLivekitServiceURL() {
      return this.livekitServiceURL;
    }
    setLivekitServiceURL(e) {
      this.livekitServiceURL = e;
    }
    waitUntilRoomReadyForGroupCalls(e) {
      return this.groupCallEventHandler.waitUntilRoomReadyForGroupCalls(
        e
      );
    }
    getGroupCallForRoom(e) {
      return this.groupCallEventHandler.groupCalls.get(e) || null;
    }
    getSyncState() {
      var e, t;
      return null !==
        (e =
          null === (t = this.syncApi) || void 0 === t
            ? void 0
            : t.getSyncState()) && void 0 !== e
        ? e
        : null;
    }
    getSyncStateData() {
      return this.syncApi ? this.syncApi.getSyncStateData() : null;
    }
    isInitialSyncComplete() {
      const e = this.getSyncState();
      return !!e && (e === i.Lm.Prepared || e === i.Lm.Syncing);
    }
    isGuest() {
      return this.isGuestAccount;
    }
    setGuest(e) {
      this.isGuestAccount = e;
    }
    getScheduler() {
      return this.scheduler;
    }
    retryImmediately() {
      var e, t;
      return (
        this.toDeviceMessageQueue.sendQueue(),
        null !==
          (e =
            null === (t = this.syncApi) || void 0 === t
              ? void 0
              : t.retryImmediately()) &&
          void 0 !== e &&
          e
      );
    }
    getNotifTimelineSet() {
      return this.notifTimelineSet;
    }
    setNotifTimelineSet(e) {
      this.notifTimelineSet = e;
    }
    getCapabilities(e = !1) {
      const t = new Date().getTime();
      return this.cachedCapabilities &&
        !e &&
        t < this.cachedCapabilities.expiration
        ? (this.logger.debug("Returning cached capabilities"),
          Promise.resolve(this.cachedCapabilities.capabilities))
        : this.http
            .authedRequest(E.IT.Get, "/capabilities")
            .catch((e) => (this.logger.error(e), {}))
            .then((e = {}) => {
              const n = e.capabilities || {},
                r = Object.keys(n).length
                  ? 216e5
                  : 6e4 + 5e3 * Math.random();
              return (
                (this.cachedCapabilities = {
                  capabilities: n,
                  expiration: t + r,
                }),
                this.logger.debug("Caching capabilities: ", n),
                n
              );
            });
    }
    async initCrypto() {
      if (!(0, w.DM)())
        throw new Error(
          "End-to-end encryption not supported in this js-sdk build: did you remember to load the olm library?"
        );
      if (this.cryptoBackend)
        return void this.logger.warn(
          "Attempt to re-initialise e2e encryption on MatrixClient"
        );
      if (!this.cryptoStore)
        throw new Error(
          "Cannot enable encryption: no cryptoStore provided"
        );
      this.logger.debug("Crypto: Starting up crypto store..."),
        await this.cryptoStore.startup();
      const e = this.getUserId();
      if (null === e)
        throw new Error(
          "Cannot enable encryption on MatrixClient with unknown userId: ensure userId is passed in createClient()."
        );
      if (null === this.deviceId)
        throw new Error(
          "Cannot enable encryption on MatrixClient with unknown deviceId: ensure deviceId is passed in createClient()."
        );
      const t = new w.Qr(
        this,
        e,
        this.deviceId,
        this.store,
        this.cryptoStore,
        this.verificationMethods
      );
      this.reEmitter.reEmit(t, [
        w.cr.KeyBackupFailed,
        w.cr.KeyBackupSessionsRemaining,
        w.cr.RoomKeyRequest,
        w.cr.RoomKeyRequestCancellation,
        w.cr.Warning,
        w.cr.DevicesUpdated,
        w.cr.WillUpdateDevices,
        w.cr.DeviceVerificationChanged,
        w.cr.UserTrustStatusChanged,
        w.cr.KeysChanged,
      ]),
        this.logger.debug("Crypto: initialising crypto object..."),
        await t.init({
          exportedOlmDevice: this.exportedOlmDeviceToImport,
          pickleKey: this.pickleKey,
        }),
        delete this.exportedOlmDeviceToImport,
        (this.olmVersion = w.Qr.getOlmVersion()),
        t.registerEventHandlers(this),
        (this.cryptoBackend = this.crypto = t),
        this.crypto.uploadDeviceKeys().catch((e) => {
          this.logger.error("Error uploading device keys", e);
        });
    }
    async initRustCrypto(e = {}) {
      var t, r;
      if (this.cryptoBackend)
        return void this.logger.warn(
          "Attempt to re-initialise e2e encryption on MatrixClient"
        );
      const o = this.getUserId();
      if (null === o)
        throw new Error(
          "Cannot enable encryption on MatrixClient with unknown userId: ensure userId is passed in createClient()."
        );
      const i = this.getDeviceId();
      if (null === i)
        throw new Error(
          "Cannot enable encryption on MatrixClient with unknown deviceId: ensure deviceId is passed in createClient()."
        );
      this.logger.debug("Downloading Rust crypto library");
      const s = await Promise.all([n.e(7490), n.e(5484)]).then(
          n.bind(
            n,
            "./node_modules/matrix-js-sdk/src/rust-crypto/index.ts"
          )
        ),
        a = await s.initRustCrypto({
          logger: this.logger,
          http: this.http,
          userId: o,
          deviceId: i,
          secretStorage: this.secretStorage,
          cryptoCallbacks: this.cryptoCallbacks,
          storePrefix: !1 === e.useIndexedDB ? null : ue,
          storeKey: e.storageKey,
          storePassphrase:
            null !== (t = e.storagePassword) && void 0 !== t
              ? t
              : this.pickleKey,
          legacyCryptoStore: this.cryptoStore,
          legacyPickleKey:
            null !== (r = this.pickleKey) && void 0 !== r
              ? r
              : "DEFAULT_KEY",
          legacyMigrationProgressListener: (e, t) => {
            this.emit(w.cr.LegacyCryptoStoreMigrationProgress, e, t);
          },
        });
      a.setSupportedVerificationMethods(this.verificationMethods),
        (this.cryptoBackend = a),
        this.on(I.o.Membership, a.onRoomMembership.bind(a)),
        this.on(Ae.Event, (e) => {
          a.onLiveEventFromSync(e);
        }),
        this.reEmitter.reEmit(a, [
          w.cr.VerificationRequestReceived,
          w.cr.UserTrustStatusChanged,
          w.cr.KeyBackupStatus,
          w.cr.KeyBackupSessionsRemaining,
          w.cr.KeyBackupFailed,
          w.cr.KeyBackupDecryptionKeyCached,
          w.cr.KeysChanged,
          w.cr.DevicesUpdated,
          w.cr.WillUpdateDevices,
        ]);
    }
    get secretStorage() {
      return this._secretStorage;
    }
    getCrypto() {
      return this.cryptoBackend;
    }
    isCryptoEnabled() {
      return !!this.cryptoBackend;
    }
    getDeviceEd25519Key() {
      var e, t;
      return null !==
        (e =
          null === (t = this.crypto) || void 0 === t
            ? void 0
            : t.getDeviceEd25519Key()) && void 0 !== e
        ? e
        : null;
    }
    getDeviceCurve25519Key() {
      var e, t;
      return null !==
        (e =
          null === (t = this.crypto) || void 0 === t
            ? void 0
            : t.getDeviceCurve25519Key()) && void 0 !== e
        ? e
        : null;
    }
    async uploadKeys() {
      this.logger.warn("MatrixClient.uploadKeys is deprecated");
    }
    downloadKeys(e, t) {
      return this.crypto
        ? this.crypto.downloadKeys(e, t)
        : Promise.reject(new Error("End-to-end encryption disabled"));
    }
    getStoredDevicesForUser(e) {
      if (!this.crypto) throw new Error("End-to-end encryption disabled");
      return this.crypto.getStoredDevicesForUser(e) || [];
    }
    getStoredDevice(e, t) {
      if (!this.crypto) throw new Error("End-to-end encryption disabled");
      return this.crypto.getStoredDevice(e, t) || null;
    }
    setDeviceVerified(e, t, n = !0) {
      const r = this.setDeviceVerification(e, t, n, null, null);
      return e == this.credentials.userId && this.checkKeyBackup(), r;
    }
    setDeviceBlocked(e, t, n = !0) {
      return this.setDeviceVerification(e, t, null, n, null);
    }
    setDeviceKnown(e, t, n = !0) {
      return this.setDeviceVerification(e, t, null, null, n);
    }
    async setDeviceVerification(e, t, n, r, o) {
      if (!this.crypto) throw new Error("End-to-end encryption disabled");
      await this.crypto.setDeviceVerification(e, t, n, r, o);
    }
    requestVerificationDM(e, t) {
      if (!this.crypto) throw new Error("End-to-end encryption disabled");
      return this.crypto.requestVerificationDM(e, t);
    }
    findVerificationRequestDMInProgress(e) {
      if (!this.cryptoBackend)
        throw new Error("End-to-end encryption disabled");
      if (this.crypto)
        return this.crypto.findVerificationRequestDMInProgress(e);
    }
    getVerificationRequestsToDeviceInProgress(e) {
      if (!this.crypto) throw new Error("End-to-end encryption disabled");
      return this.crypto.getVerificationRequestsToDeviceInProgress(e);
    }
    requestVerification(e, t) {
      if (!this.crypto) throw new Error("End-to-end encryption disabled");
      return this.crypto.requestVerification(e, t);
    }
    beginKeyVerification(e, t, n) {
      if (!this.crypto) throw new Error("End-to-end encryption disabled");
      return this.crypto.beginKeyVerification(e, t, n);
    }
    checkSecretStorageKey(e, t) {
      return this.secretStorage.checkKey(e, t);
    }
    setGlobalBlacklistUnverifiedDevices(e) {
      if (!this.cryptoBackend)
        throw new Error("End-to-end encryption disabled");
      return (this.cryptoBackend.globalBlacklistUnverifiedDevices = e), e;
    }
    getGlobalBlacklistUnverifiedDevices() {
      if (!this.cryptoBackend)
        throw new Error("End-to-end encryption disabled");
      return this.cryptoBackend.globalBlacklistUnverifiedDevices;
    }
    setGlobalErrorOnUnknownDevices(e) {
      if (!this.cryptoBackend)
        throw new Error("End-to-end encryption disabled");
      this.cryptoBackend.globalErrorOnUnknownDevices = e;
    }
    getGlobalErrorOnUnknownDevices() {
      if (!this.cryptoBackend)
        throw new Error("End-to-end encryption disabled");
      return this.cryptoBackend.globalErrorOnUnknownDevices;
    }
    getCrossSigningId(e = T.n.Master) {
      if (!this.crypto) throw new Error("End-to-end encryption disabled");
      return this.crypto.getCrossSigningId(e);
    }
    getStoredCrossSigningForUser(e) {
      if (!this.cryptoBackend)
        throw new Error("End-to-end encryption disabled");
      return this.cryptoBackend.getStoredCrossSigningForUser(e);
    }
    checkUserTrust(e) {
      if (!this.cryptoBackend)
        throw new Error("End-to-end encryption disabled");
      return this.cryptoBackend.checkUserTrust(e);
    }
    checkDeviceTrust(e, t) {
      if (!this.crypto) throw new Error("End-to-end encryption disabled");
      return this.crypto.checkDeviceTrust(e, t);
    }
    checkIfOwnDeviceCrossSigned(e) {
      if (!this.crypto) throw new Error("End-to-end encryption disabled");
      return this.crypto.checkIfOwnDeviceCrossSigned(e);
    }
    checkOwnCrossSigningTrust(e) {
      if (!this.cryptoBackend)
        throw new Error("End-to-end encryption disabled");
      return this.cryptoBackend.checkOwnCrossSigningTrust(e);
    }
    checkCrossSigningPrivateKey(e, t) {
      if (!this.crypto) throw new Error("End-to-end encryption disabled");
      return this.crypto.checkCrossSigningPrivateKey(e, t);
    }
    legacyDeviceVerification(e, t, n) {
      if (!this.crypto) throw new Error("End-to-end encryption disabled");
      return this.crypto.legacyDeviceVerification(e, t, n);
    }
    prepareToEncrypt(e) {
      if (!this.cryptoBackend)
        throw new Error("End-to-end encryption disabled");
      this.cryptoBackend.prepareToEncrypt(e);
    }
    userHasCrossSigningKeys() {
      if (!this.cryptoBackend)
        throw new Error("End-to-end encryption disabled");
      return this.cryptoBackend.userHasCrossSigningKeys();
    }
    isCrossSigningReady() {
      if (!this.cryptoBackend)
        throw new Error("End-to-end encryption disabled");
      return this.cryptoBackend.isCrossSigningReady();
    }
    bootstrapCrossSigning(e) {
      if (!this.cryptoBackend)
        throw new Error("End-to-end encryption disabled");
      return this.cryptoBackend.bootstrapCrossSigning(e);
    }
    getCryptoTrustCrossSignedDevices() {
      if (!this.cryptoBackend)
        throw new Error("End-to-end encryption disabled");
      return this.cryptoBackend.getTrustCrossSignedDevices();
    }
    setCryptoTrustCrossSignedDevices(e) {
      if (!this.cryptoBackend)
        throw new Error("End-to-end encryption disabled");
      this.cryptoBackend.setTrustCrossSignedDevices(e);
    }
    countSessionsNeedingBackup() {
      if (!this.crypto) throw new Error("End-to-end encryption disabled");
      return this.crypto.countSessionsNeedingBackup();
    }
    getEventEncryptionInfo(e) {
      if (!this.cryptoBackend)
        throw new Error("End-to-end encryption disabled");
      return this.cryptoBackend.getEventEncryptionInfo(e);
    }
    createRecoveryKeyFromPassphrase(e) {
      if (!this.cryptoBackend)
        throw new Error("End-to-end encryption disabled");
      return this.cryptoBackend.createRecoveryKeyFromPassphrase(e);
    }
    isSecretStorageReady() {
      if (!this.cryptoBackend)
        throw new Error("End-to-end encryption disabled");
      return this.cryptoBackend.isSecretStorageReady();
    }
    bootstrapSecretStorage(e) {
      if (!this.cryptoBackend)
        throw new Error("End-to-end encryption disabled");
      return this.cryptoBackend.bootstrapSecretStorage(e);
    }
    addSecretStorageKey(e, t, n) {
      return this.secretStorage.addKey(e, t, n);
    }
    hasSecretStorageKey(e) {
      return this.secretStorage.hasKey(e);
    }
    storeSecret(e, t, n) {
      return this.secretStorage.store(e, t, n);
    }
    getSecret(e) {
      return this.secretStorage.get(e);
    }
    isSecretStored(e) {
      return this.secretStorage.isStored(e);
    }
    requestSecret(e, t) {
      if (!this.crypto) throw new Error("End-to-end encryption disabled");
      return this.crypto.requestSecret(e, t);
    }
    getDefaultSecretStorageKeyId() {
      return this.secretStorage.getDefaultKeyId();
    }
    setDefaultSecretStorageKeyId(e) {
      return this.secretStorage.setDefaultKeyId(e);
    }
    checkSecretStoragePrivateKey(e, t) {
      if (!this.crypto) throw new Error("End-to-end encryption disabled");
      return this.crypto.checkSecretStoragePrivateKey(e, t);
    }
    async getEventSenderDeviceInfo(e) {
      return this.crypto ? this.crypto.getEventSenderDeviceInfo(e) : null;
    }
    async isEventSenderVerified(e) {
      const t = await this.getEventSenderDeviceInfo(e);
      return !!t && t.isVerified();
    }
    getOutgoingRoomKeyRequest(e) {
      if (!this.crypto) throw new Error("End-to-End encryption disabled");
      const t = e.getWireContent(),
        n = {
          session_id: t.session_id,
          sender_key: t.sender_key,
          algorithm: t.algorithm,
          room_id: e.getRoomId(),
        };
      return n.session_id && n.sender_key && n.algorithm && n.room_id
        ? this.crypto.cryptoStore.getOutgoingRoomKeyRequest(n)
        : Promise.resolve(null);
    }
    cancelAndResendEventRoomKeyRequest(e) {
      if (!this.crypto) throw new Error("End-to-End encryption disabled");
      return e.cancelAndResendKeyRequest(this.crypto, this.getUserId());
    }
    setRoomEncryption(e, t) {
      if (!this.crypto) throw new Error("End-to-End encryption disabled");
      return this.crypto.setRoomEncryption(e, t);
    }
    isRoomEncrypted(e) {
      var t, n;
      const r = this.getRoom(e);
      return (
        !!r &&
        (!!r.hasEncryptionStateEvent() ||
          (null !==
            (t =
              null === (n = this.crypto) || void 0 === n
                ? void 0
                : n.isRoomEncrypted(e)) &&
            void 0 !== t &&
            t))
      );
    }
    encryptAndSendToDevices(e, t) {
      if (!this.crypto) throw new Error("End-to-End encryption disabled");
      return this.crypto.encryptAndSendToDevices(e, t);
    }
    forceDiscardSession(e) {
      if (!this.cryptoBackend)
        throw new Error("End-to-End encryption disabled");
      this.cryptoBackend.forceDiscardSession(e);
    }
    exportRoomKeys() {
      return this.cryptoBackend
        ? this.cryptoBackend.exportRoomKeys()
        : Promise.reject(new Error("End-to-end encryption disabled"));
    }
    importRoomKeys(e, t) {
      if (!this.cryptoBackend)
        throw new Error("End-to-end encryption disabled");
      return this.cryptoBackend.importRoomKeys(e, t);
    }
    checkKeyBackup() {
      if (!this.crypto) throw new Error("End-to-end encryption disabled");
      return this.crypto.backupManager.checkKeyBackup();
    }
    async getKeyBackupVersion() {
      let e;
      try {
        e = await this.http.authedRequest(
          E.IT.Get,
          "/room_keys/version",
          void 0,
          void 0,
          { prefix: E.iD.V3 }
        );
      } catch (e) {
        if ("M_NOT_FOUND" === e.errcode) return null;
        throw e;
      }
      return B.IO.checkBackupVersion(e), e;
    }
    isKeyBackupTrusted(e) {
      if (!this.crypto) throw new Error("End-to-end encryption disabled");
      return this.crypto.backupManager.isKeyBackupTrusted(e);
    }
    getKeyBackupEnabled() {
      if (!this.crypto) throw new Error("End-to-end encryption disabled");
      return this.crypto.backupManager.getKeyBackupEnabled();
    }
    enableKeyBackup(e) {
      if (!this.crypto) throw new Error("End-to-end encryption disabled");
      return this.crypto.backupManager.enableKeyBackup(e);
    }
    disableKeyBackup() {
      if (!this.crypto) throw new Error("End-to-end encryption disabled");
      this.crypto.backupManager.disableKeyBackup();
    }
    async prepareKeyBackupVersion(e, t = { secureSecretStorage: !1 }) {
      if (!this.crypto) throw new Error("End-to-end encryption disabled");
      const {
        algorithm: n,
        auth_data: r,
        recovery_key: o,
        privateKey: i,
      } = await this.crypto.backupManager.prepareKeyBackupVersion(e);
      return (
        t.secureSecretStorage &&
          (await this.secretStorage.store(
            "m.megolm_backup.v1",
            (0, v.WG)(i)
          ),
          this.logger.info(
            "Key backup private key stored in secret storage"
          )),
        { algorithm: n, auth_data: r, recovery_key: o }
      );
    }
    isKeyBackupKeyStored() {
      return Promise.resolve(
        this.secretStorage.isStored("m.megolm_backup.v1")
      );
    }
    async createKeyBackupVersion(e) {
      if (!this.crypto) throw new Error("End-to-end encryption disabled");
      await this.crypto.backupManager.createKeyBackupVersion(e);
      const t = { algorithm: e.algorithm, auth_data: e.auth_data };
      await this.crypto.signObject(t.auth_data),
        this.cryptoCallbacks.getCrossSigningKey &&
          this.crypto.crossSigningInfo.getId() &&
          (await this.crypto.crossSigningInfo.signObject(
            t.auth_data,
            "master"
          ));
      const n = await this.http.authedRequest(
        E.IT.Post,
        "/room_keys/version",
        void 0,
        t
      );
      return (
        await this.checkKeyBackup(),
        this.getKeyBackupEnabled() ||
          this.logger.error(
            "Key backup not usable even though we just created it"
          ),
        n
      );
    }
    async deleteKeyBackupVersion(e) {
      if (!this.cryptoBackend)
        throw new Error("End-to-end encryption disabled");
      await this.cryptoBackend.deleteKeyBackupVersion(e);
    }
    makeKeyBackupPath(e, t, n) {
      let r;
      r =
        void 0 !== t
          ? m.RR("/room_keys/keys/$roomId/$sessionId", {
              $roomId: e,
              $sessionId: t,
            })
          : void 0 !== e
          ? m.RR("/room_keys/keys/$roomId", { $roomId: e })
          : "/room_keys/keys";
      return {
        path: r,
        queryData: void 0 === n ? void 0 : { version: n },
      };
    }
    async sendKeyBackup(e, t, n, r) {
      if (!this.crypto) throw new Error("End-to-end encryption disabled");
      const o = this.makeKeyBackupPath(e, t, n);
      await this.http.authedRequest(E.IT.Put, o.path, o.queryData, r, {
        prefix: E.iD.V3,
      });
    }
    async scheduleAllGroupSessionsForBackup() {
      if (!this.crypto) throw new Error("End-to-end encryption disabled");
      await this.crypto.backupManager.scheduleAllGroupSessionsForBackup();
    }
    flagAllGroupSessionsForBackup() {
      if (!this.crypto) throw new Error("End-to-end encryption disabled");
      return this.crypto.backupManager.flagAllGroupSessionsForBackup();
    }
    isValidRecoveryKey(e) {
      try {
        return (0, x.R)(e), !0;
      } catch (e) {
        return !1;
      }
    }
    keyBackupKeyFromPassword(e, t) {
      return (0, k.cE)(t.auth_data, e);
    }
    keyBackupKeyFromRecoveryKey(e) {
      return (0, x.R)(e);
    }
    async restoreKeyBackupWithPassword(e, t, n, r, o) {
      const i = await (0, k.cE)(r.auth_data, e);
      return this.restoreKeyBackup(i, t, n, r, o);
    }
    async restoreKeyBackupWithSecretStorage(e, t, n, r) {
      if (!this.cryptoBackend)
        throw new Error("End-to-end encryption disabled");
      const o = await this.secretStorage.get("m.megolm_backup.v1"),
        i = (0, w.D$)(o);
      if (i) {
        const e = await this.secretStorage.getKey();
        await this.secretStorage.store("m.megolm_backup.v1", i, [e[0]]);
      }
      const s = (0, v.y4)(i || o);
      return this.restoreKeyBackup(s, t, n, e, r);
    }
    restoreKeyBackupWithRecoveryKey(e, t, n, r, o) {
      const i = (0, x.R)(e);
      return this.restoreKeyBackup(i, t, n, r, o);
    }
    async restoreKeyBackupWithCache(e, t, n, r) {
      if (!this.cryptoBackend)
        throw new Error("End-to-end encryption disabled");
      const o = await this.cryptoBackend.getSessionBackupPrivateKey();
      if (!o) throw new Error("Couldn't get key");
      return this.restoreKeyBackup(o, e, t, n, r);
    }
    async restoreKeyBackup(e, t, n, r, o) {
      const i = null == o ? void 0 : o.cacheCompleteCallback,
        s = null == o ? void 0 : o.progressCallback;
      if (!this.cryptoBackend)
        throw new Error("End-to-end encryption disabled");
      if (!r.version) throw new Error("Backup version must be defined");
      const a = r.version;
      let l = 0,
        c = 0,
        d = 0;
      const u = this.makeKeyBackupPath(t, n, a),
        m = await this.cryptoBackend.getBackupDecryptor(r, e),
        h = !m.sourceTrusted;
      try {
        if (!(e instanceof Uint8Array))
          throw new Error(
            `restoreKeyBackup expects Uint8Array, got ${e}`
          );
        this.cryptoBackend
          .storeSessionBackupPrivateKey(e, a)
          .catch((e) => {
            this.logger.warn("Error caching session backup key:", e);
          })
          .then(i),
          s && s({ stage: "fetch" });
        const o = await this.http.authedRequest(
          E.IT.Get,
          u.path,
          u.queryData,
          void 0,
          { prefix: E.iD.V3 }
        );
        if ((s && s({ stage: "load_keys" }), o.rooms))
          (l = this.getTotalKeyCount(o)),
            await this.handleDecryptionOfAFullBackup(
              o,
              m,
              200,
              async (e) => {
                try {
                  const t = r.version;
                  await this.cryptoBackend.importBackedUpRoomKeys(e, t, {
                    untrusted: h,
                  }),
                    (d += e.length);
                } catch (t) {
                  (c += e.length),
                    _.v.error("Error importing keys from backup", t);
                }
                s &&
                  s({
                    total: l,
                    successes: d,
                    stage: "load_keys",
                    failures: c,
                  });
              }
            );
        else if (o.sessions) {
          const e = o.sessions;
          l = Object.keys(e).length;
          const n = await m.decryptSessions(e);
          for (const e of n) e.room_id = t;
          await this.cryptoBackend.importBackedUpRoomKeys(n, a, {
            progressCallback: s,
            untrusted: h,
          }),
            (d = n.length);
        } else {
          l = 1;
          try {
            const [e] = await m.decryptSessions({ [n]: o });
            (e.room_id = t),
              (e.session_id = n),
              await this.cryptoBackend.importBackedUpRoomKeys([e], a, {
                progressCallback: s,
                untrusted: h,
              }),
              (d = 1);
          } catch (e) {
            this.logger.debug(
              "Failed to decrypt megolm session from backup",
              e
            );
          }
        }
      } finally {
        m.free();
      }
      return (
        await this.cryptoBackend.checkKeyBackupAndEnable(),
        { total: l, imported: d }
      );
    }
    getTotalKeyCount(e) {
      const t = e.rooms;
      let n = 0;
      for (const e of Object.values(t))
        e.sessions && (n += Object.keys(e.sessions).length);
      return n;
    }
    async handleDecryptionOfAFullBackup(e, t, n, r) {
      const o = e.rooms;
      let i = 0,
        s = new Map();
      const a = async (e) => {
        const n = [];
        for (const r of e.keys()) {
          const o = await t.decryptSessions(e.get(r));
          for (const e in o) {
            const t = o[e];
            (t.room_id = r), n.push(t);
          }
        }
        await r(n);
      };
      for (const [e, t] of Object.entries(o))
        if (t.sessions) {
          s.set(e, {});
          for (const [r, o] of Object.entries(t.sessions)) {
            (s.get(e)[r] = o),
              (i += 1),
              i >= n &&
                (await a(s), (s = new Map()), s.set(e, {}), (i = 0));
          }
        }
      i > 0 && (await a(s));
    }
    async deleteKeysFromBackup(e, t, n) {
      if (!this.crypto) throw new Error("End-to-end encryption disabled");
      const r = this.makeKeyBackupPath(e, t, n);
      await this.http.authedRequest(
        E.IT.Delete,
        r.path,
        r.queryData,
        void 0,
        { prefix: E.iD.V3 }
      );
    }
    async sendSharedHistoryKeys(e, t) {
      var n;
      if (!this.crypto) throw new Error("End-to-end encryption disabled");
      const r =
        null === (n = this.crypto) || void 0 === n
          ? void 0
          : n.getRoomEncryption(e);
      if (!r)
        return void this.logger.error(
          "Unknown room.  Not sharing decryption keys"
        );
      const o = await this.crypto.downloadKeys(t),
        i = new Map();
      for (const [e, t] of o) i.set(e, Array.from(t.values()));
      const s = this.crypto.getRoomDecryptor(e, r.algorithm);
      s.sendSharedHistoryInboundSessions
        ? await s.sendSharedHistoryInboundSessions(i)
        : this.logger.warn(
            "Algorithm does not support sharing previous keys",
            r.algorithm
          );
    }
    getMediaConfig() {
      return this.http.authedRequest(
        E.IT.Get,
        "/config",
        void 0,
        void 0,
        { prefix: E.zs.V3 }
      );
    }
    getRoom(e) {
      return e ? this.store.getRoom(e) : null;
    }
    getRooms() {
      return this.store.getRooms();
    }
    getVisibleRooms(e = !1) {
      const t = this.store.getRooms(),
        n = new Set();
      for (const o of t) {
        var r;
        const t =
          null === (r = o.findPredecessor(e)) || void 0 === r
            ? void 0
            : r.roomId;
        t && n.add(t);
      }
      return t.filter(
        (e) =>
          !e.currentState.getStateEvents(O.Bx.RoomTombstone, "") ||
          !n.has(e.roomId)
      );
    }
    getUser(e) {
      return this.store.getUser(e);
    }
    getUsers() {
      return this.store.getUsers();
    }
    setAccountData(e, t) {
      const n = m.RR("/user/$userId/account_data/$type", {
        $userId: this.credentials.userId,
        $type: e,
      });
      return (0, E.Y6)(5, () =>
        this.http.authedRequest(E.IT.Put, n, void 0, t)
      );
    }
    getAccountData(e) {
      return this.store.getAccountData(e);
    }
    async getAccountDataFromServer(e) {
      if (this.isInitialSyncComplete()) {
        const t = this.store.getAccountData(e);
        return t ? t.getContent() : null;
      }
      const t = m.RR("/user/$userId/account_data/$type", {
        $userId: this.credentials.userId,
        $type: e,
      });
      try {
        return await this.http.authedRequest(E.IT.Get, t);
      } catch (e) {
        var n;
        if (
          "M_NOT_FOUND" ===
          (null === (n = e.data) || void 0 === n ? void 0 : n.errcode)
        )
          return null;
        throw e;
      }
    }
    async deleteAccountData(e) {
      const t = this.canSupport.get(de.Xj.AccountDataDeletion);
      if (t === de.Tj.Unsupported)
        return void (await this.setAccountData(e, {}));
      const n = m.RR("/user/$userId/account_data/$type", {
          $userId: this.getSafeUserId(),
          $type: e,
        }),
        r =
          t === de.Tj.Unstable
            ? { prefix: "/_matrix/client/unstable/org.matrix.msc3391" }
            : void 0;
      return await this.http.authedRequest(
        E.IT.Delete,
        n,
        void 0,
        void 0,
        r
      );
    }
    getIgnoredUsers() {
      const e = this.getAccountData("m.ignored_user_list");
      return e && e.getContent() && e.getContent().ignored_users
        ? Object.keys(e.getContent().ignored_users)
        : [];
    }
    setIgnoredUsers(e) {
      const t = { ignored_users: {} };
      return (
        e.forEach((e) => {
          t.ignored_users[e] = {};
        }),
        this.setAccountData("m.ignored_user_list", t)
      );
    }
    isUserIgnored(e) {
      return this.getIgnoredUsers().includes(e);
    }
    async joinRoom(e, t = {}) {
      void 0 === t.syncRoom && (t.syncRoom = !0);
      const n = this.getRoom(e);
      if (
        null != n &&
        n.hasMembershipState(this.credentials.userId, H.O.Join)
      )
        return n;
      let r = Promise.resolve();
      if (t.inviteSignUrl) {
        const e = new URL(t.inviteSignUrl);
        e.searchParams.set("mxid", this.credentials.userId),
          (r = this.http.requestOtherUrl(E.IT.Post, e));
      }
      const o = {};
      t.viaServers && (o.server_name = t.viaServers);
      const s = {},
        a = await r;
      a && (s.third_party_signed = a);
      const l = m.RR("/join/$roomid", { $roomid: e }),
        c = (await this.http.authedRequest(E.IT.Post, l, o, s)).room_id,
        d = this.getRoom(c);
      if (
        null != d &&
        d.hasMembershipState(this.credentials.userId, H.O.Join)
      )
        return d;
      const u = new i.w_(
        this,
        this.clientOpts,
        this.buildSyncApiOptions()
      ).createRoom(c);
      return t.syncRoom, u;
    }
    knockRoom(e, t = {}) {
      const n = this.getRoom(e);
      if (
        null != n &&
        n.hasMembershipState(this.credentials.userId, H.O.Knock)
      )
        return Promise.resolve({ room_id: n.roomId });
      const r = m.RR("/knock/$roomIdOrAlias", { $roomIdOrAlias: e }),
        o = {};
      t.viaServers && (o.server_name = t.viaServers);
      const i = {};
      return (
        t.reason && (i.reason = t.reason),
        this.http.authedRequest(E.IT.Post, r, o, i)
      );
    }
    resendEvent(e, t) {
      return (
        this.toDeviceMessageQueue.sendQueue(),
        this.updatePendingEventStatus(t, e, s.fb.SENDING),
        this.encryptAndSendEvent(t, e)
      );
    }
    cancelPendingEvent(e) {
      if (
        ![s.fb.QUEUED, s.fb.NOT_SENT, s.fb.ENCRYPTING].includes(e.status)
      )
        throw new Error("cannot cancel an event with status " + e.status);
      e.status === s.fb.ENCRYPTING
        ? this.eventsBeingEncrypted.delete(e.getId())
        : this.scheduler &&
          e.status === s.fb.QUEUED &&
          this.scheduler.removeEventFromQueue(e);
      const t = this.getRoom(e.getRoomId());
      this.updatePendingEventStatus(t, e, s.fb.CANCELLED);
    }
    setRoomName(e, t) {
      return this.sendStateEvent(e, O.Bx.RoomName, { name: t });
    }
    setRoomTopic(e, t, n) {
      const r = D.makeTopicContent(t, n);
      return this.sendStateEvent(e, O.Bx.RoomTopic, r);
    }
    getRoomTags(e) {
      const t = m.RR("/user/$userId/rooms/$roomId/tags", {
        $userId: this.credentials.userId,
        $roomId: e,
      });
      return this.http.authedRequest(E.IT.Get, t);
    }
    setRoomTag(e, t, n = {}) {
      const r = m.RR("/user/$userId/rooms/$roomId/tags/$tag", {
        $userId: this.credentials.userId,
        $roomId: e,
        $tag: t,
      });
      return this.http.authedRequest(E.IT.Put, r, void 0, n);
    }
    deleteRoomTag(e, t) {
      const n = m.RR("/user/$userId/rooms/$roomId/tags/$tag", {
        $userId: this.credentials.userId,
        $roomId: e,
        $tag: t,
      });
      return this.http.authedRequest(E.IT.Delete, n);
    }
    setRoomAccountData(e, t, n) {
      const r = m.RR("/user/$userId/rooms/$roomId/account_data/$type", {
        $userId: this.credentials.userId,
        $roomId: e,
        $type: t,
      });
      return this.http.authedRequest(E.IT.Put, r, void 0, n);
    }
    async setPowerLevel(e, t, n) {
      var r;
      let o;
      var i, s, a;
      this.clientRunning &&
        this.isInitialSyncComplete() &&
        (o =
          null === (i = this.getRoom(e)) ||
          void 0 === i ||
          null === (s = i.currentState) ||
          void 0 === s ||
          null === (a = s.getStateEvents(O.Bx.RoomPowerLevels, "")) ||
          void 0 === a
            ? void 0
            : a.getContent());
      if (!o)
        try {
          o = await this.getStateEvent(e, O.Bx.RoomPowerLevels, "");
        } catch (e) {
          if (!(e instanceof E.up && "M_NOT_FOUND" === e.errcode))
            throw e;
          o = {};
        }
      (o = m.A4(o)),
        (null !== (r = o) && void 0 !== r && r.users) || (o.users = {});
      const l = Array.isArray(t) ? t : [t];
      for (const e of l) null == n ? delete o.users[e] : (o.users[e] = n);
      return this.sendStateEvent(e, O.Bx.RoomPowerLevels, o, "");
    }
    async unstable_createLiveBeacon(e, t) {
      return this.unstable_setLiveBeacon(e, t);
    }
    async unstable_setLiveBeacon(e, t) {
      return this.sendStateEvent(e, ie.E.name, t, this.getUserId());
    }
    sendEvent(e, t, n, r, o) {
      var i;
      let s, a, l, c;
      if (
        ((null != t && t.startsWith(Ce)) || null === t
          ? ((c = o), (l = r), (a = n), (s = t))
          : ((c = r), (l = n), (a = t), (s = null)),
        s &&
          (null === (i = l["m.relates_to"]) ||
            void 0 === i ||
            !i.rel_type))
      ) {
        var d, u;
        const t = !(
          null === (d = l["m.relates_to"]) ||
          void 0 === d ||
          !d["m.in_reply_to"]
        );
        l["m.relates_to"] = ve(
          ve({}, l["m.relates_to"]),
          {},
          { rel_type: oe.RN.name, event_id: s, is_falling_back: !t }
        );
        const n =
          null === (u = this.getRoom(e)) || void 0 === u
            ? void 0
            : u.getThread(s);
        var m, h;
        if (n && !t)
          l["m.relates_to"]["m.in_reply_to"] = {
            event_id:
              null !==
                (m =
                  null ===
                    (h = n.lastReply(
                      (e) => e.isRelation(oe.RN.name) && !e.status
                    )) || void 0 === h
                    ? void 0
                    : h.getId()) && void 0 !== m
                ? m
                : s,
          };
      }
      return this.sendCompleteEvent(e, s, { type: a, content: l }, c);
    }
    sendCompleteEvent(e, t, n, r) {
      r || (r = this.makeTxnId());
      const o = new s.kl(
          Object.assign(n, {
            event_id: "~" + e + ":" + r,
            user_id: this.credentials.userId,
            sender: this.credentials.userId,
            room_id: e,
            origin_server_ts: new Date().getTime(),
          })
        ),
        i = this.getRoom(e),
        a = t ? (null == i ? void 0 : i.getThread(t)) : void 0;
      a && o.setThread(a),
        this.reEmitter.reEmit(o, [s.OQ.Replaced, s.OQ.VisibilityChange]),
        null == i || i.reEmitter.reEmit(o, [s.OQ.BeforeRedaction]);
      const l = o.getAssociatedId();
      if (null != l && l.startsWith("~")) {
        const e =
          null == i
            ? void 0
            : i.getPendingEvents().find((e) => e.getId() === l);
        null == e ||
          e.once(s.OQ.LocalEventIdReplaced, () => {
            o.updateAssociatedId(e.getId());
          });
      }
      const c = o.getType();
      return (
        this.logger.debug(
          `sendEvent of type ${c} in ${e} with txnId ${r}`
        ),
        o.setTxnId(r),
        o.setStatus(s.fb.SENDING),
        null == i || i.addPendingEvent(o, r),
        o.status === s.fb.NOT_SENT
          ? Promise.reject(
              new Error("Event blocked by other events not yet sent")
            )
          : this.encryptAndSendEvent(i, o)
      );
    }
    async encryptAndSendEvent(e, t) {
      try {
        let n;
        this.eventsBeingEncrypted.add(t.getId());
        try {
          await this.encryptEventIfNeeded(t, null != e ? e : void 0);
        } finally {
          n = !this.eventsBeingEncrypted.delete(t.getId());
        }
        if (n) return {};
        t.status === s.fb.ENCRYPTING &&
          this.updatePendingEventStatus(e, t, s.fb.SENDING);
        let r = null;
        return (
          this.scheduler &&
            ((r = this.scheduler.queueEvent(t)),
            r &&
              this.scheduler.getQueueForEvent(t).length > 1 &&
              this.updatePendingEventStatus(e, t, s.fb.QUEUED)),
          r ||
            ((r = this.sendEventHttpRequest(t)),
            e &&
              (r = r.then(
                (n) => (e.updatePendingEvent(t, s.fb.SENT, n.event_id), n)
              ))),
          await r
        );
      } catch (n) {
        this.logger.error("Error sending event", n);
        try {
          (t.error = n),
            this.updatePendingEventStatus(e, t, s.fb.NOT_SENT);
        } catch (e) {
          this.logger.error("Exception in error handler!", e);
        }
        throw (n instanceof E.up && (n.event = t), n);
      }
    }
    async encryptEventIfNeeded(e, t) {
      if (
        t &&
        (await this.shouldEncryptEventForRoom(e, t)) &&
        (this.cryptoBackend || !this.usingExternalCrypto)
      ) {
        if (!this.cryptoBackend)
          throw new Error(
            "This room is configured to use encryption, but your client does not support encryption."
          );
        this.updatePendingEventStatus(t, e, s.fb.ENCRYPTING),
          await this.cryptoBackend.encryptEvent(e, t);
      }
    }
    async shouldEncryptEventForRoom(e, t) {
      var n;
      return (
        !e.isEncrypted() &&
        e.getType() !== O.Bx.Reaction &&
        !e.isRedaction() &&
        (!!t.hasEncryptionStateEvent() ||
          !!(await (null === (n = this.cryptoBackend) || void 0 === n
            ? void 0
            : n.isEncryptionEnabledInRoom(t.roomId))))
      );
    }
    getEncryptedIfNeededEventType(e, t) {
      var n;
      return t === O.Bx.Reaction
        ? t
        : null !== (n = this.getRoom(e)) &&
          void 0 !== n &&
          n.hasEncryptionStateEvent()
        ? O.Bx.RoomMessageEncrypted
        : t;
    }
    updatePendingEventStatus(e, t, n) {
      e ? e.updatePendingEvent(t, n) : t.setStatus(n);
    }
    sendEventHttpRequest(e) {
      let t = e.getTxnId();
      t || ((t = this.makeTxnId()), e.setTxnId(t));
      const n = {
        $roomId: e.getRoomId(),
        $eventType: e.getWireType(),
        $stateKey: e.getStateKey(),
        $txnId: t,
      };
      let r;
      if (e.isState()) {
        let t = "/rooms/$roomId/state/$eventType";
        e.getStateKey() &&
          e.getStateKey().length > 0 &&
          (t = "/rooms/$roomId/state/$eventType/$stateKey"),
          (r = m.RR(t, n));
      } else if (e.isRedaction() && e.event.redacts) {
        const t = "/rooms/$roomId/redact/$redactsEventId/$txnId";
        r = m.RR(t, ve({ $redactsEventId: e.event.redacts }, n));
      } else r = m.RR("/rooms/$roomId/send/$eventType/$txnId", n);
      return this.http
        .authedRequest(E.IT.Put, r, void 0, e.getWireContent())
        .then(
          (t) => (
            this.logger.debug(
              `Event sent to ${e.getRoomId()} with event id ${t.event_id}`
            ),
            t
          )
        );
    }
    redactEvent(e, t, n, r, o) {
      var i, s, a;
      (null !== (i = n) && void 0 !== i && i.startsWith(Ce)) ||
        ((o = r), (r = n), (n = t), (t = null));
      const l = {
        reason: null === (s = o) || void 0 === s ? void 0 : s.reason,
      };
      if (
        void 0 !==
        (null === (a = o) || void 0 === a ? void 0 : a.with_rel_types)
      ) {
        if (
          this.canSupport.get(de.Xj.RelationBasedRedactions) ===
          de.Tj.Unsupported
        )
          throw new Error(
            `Server does not support relation based redactions roomId ${e} eventId ${n} txnId: ${r} threadId ${t}`
          );
        l[
          this.canSupport.get(de.Xj.RelationBasedRedactions) ===
          de.Tj.Stable
            ? O.Z3.stable
            : O.Z3.unstable
        ] = o.with_rel_types;
      }
      return this.sendCompleteEvent(
        e,
        t,
        { type: O.Bx.RoomRedaction, content: l, redacts: n },
        r
      );
    }
    sendMessage(e, t, n, r) {
      "string" != typeof t &&
        null !== t &&
        ((r = n), (n = t), (t = null));
      const o = O.Bx.RoomMessage,
        i = n;
      return this.sendEvent(e, t, o, i, r);
    }
    sendTextMessage(e, t, n, r) {
      var o;
      (null !== (o = t) && void 0 !== o && o.startsWith(Ce)) ||
        null === t ||
        ((r = n), (n = t), (t = null));
      const i = D.makeTextMessage(n);
      return this.sendMessage(e, t, i, r);
    }
    sendNotice(e, t, n, r) {
      var o;
      (null !== (o = t) && void 0 !== o && o.startsWith(Ce)) ||
        null === t ||
        ((r = n), (n = t), (t = null));
      const i = D.makeNotice(n);
      return this.sendMessage(e, t, i, r);
    }
    sendEmoteMessage(e, t, n, r) {
      var o;
      (null !== (o = t) && void 0 !== o && o.startsWith(Ce)) ||
        null === t ||
        ((r = n), (n = t), (t = null));
      const i = D.makeEmoteMessage(n);
      return this.sendMessage(e, t, i, r);
    }
    sendImageMessage(e, t, n, r, o = "Image") {
      var i;
      (null !== (i = t) && void 0 !== i && i.startsWith(Ce)) ||
        null === t ||
        ((o = r || "Image"), (r = n), (n = t), (t = null));
      const s = { msgtype: O.Wr.Image, url: n, info: r, body: o };
      return this.sendMessage(e, t, s);
    }
    sendStickerMessage(e, t, n, r, o = "Sticker") {
      var i;
      (null !== (i = t) && void 0 !== i && i.startsWith(Ce)) ||
        null === t ||
        ((o = r || "Sticker"), (r = n), (n = t), (t = null));
      const s = { url: n, info: r, body: o };
      return this.sendEvent(e, t, O.Bx.Sticker, s);
    }
    sendHtmlMessage(e, t, n, r) {
      var o;
      (null !== (o = t) && void 0 !== o && o.startsWith(Ce)) ||
        null === t ||
        ((r = n), (n = t), (t = null));
      const i = D.makeHtmlMessage(n, r);
      return this.sendMessage(e, t, i);
    }
    sendHtmlNotice(e, t, n, r) {
      var o;
      (null !== (o = t) && void 0 !== o && o.startsWith(Ce)) ||
        null === t ||
        ((r = n), (n = t), (t = null));
      const i = D.makeHtmlNotice(n, r);
      return this.sendMessage(e, t, i);
    }
    sendHtmlEmote(e, t, n, r) {
      var o;
      (null !== (o = t) && void 0 !== o && o.startsWith(Ce)) ||
        null === t ||
        ((r = n), (n = t), (t = null));
      const i = D.makeHtmlEmote(n, r);
      return this.sendMessage(e, t, i);
    }
    async sendReceipt(e, t, n, r = !1) {
      if (this.isGuest()) return Promise.resolve({});
      const o = m.RR("/rooms/$roomId/receipt/$receiptType/$eventId", {
          $roomId: e.getRoomId(),
          $receiptType: t,
          $eventId: e.getId(),
        }),
        i =
          !r && this.supportsThreads()
            ? ve(ve({}, n), {}, { thread_id: Ie(e) })
            : n,
        s = this.http.authedRequest(E.IT.Post, o, void 0, i || {}),
        a = this.getRoom(e.getRoomId());
      return (
        a &&
          this.credentials.userId &&
          a.addLocalEchoReceipt(this.credentials.userId, e, t, r),
        s
      );
    }
    async sendReadReceipt(e, t = ne.L.Read, n = !1) {
      if (!e) return;
      const r = e.getId(),
        o = this.getRoom(e.getRoomId());
      if (null != o && o.hasPendingEvent(r))
        throw new Error(
          `Cannot set read receipt to a pending event (${r})`
        );
      return this.sendReceipt(e, t, {}, n);
    }
    async setRoomReadMarkers(e, t, n, r) {
      const o = this.getRoom(e);
      if (null != o && o.hasPendingEvent(t))
        throw new Error(
          `Cannot set read marker to a pending event (${t})`
        );
      let i, s;
      if (n) {
        if (((i = n.getId()), null != o && o.hasPendingEvent(i)))
          throw new Error(
            `Cannot set read receipt to a pending event (${i})`
          );
        null == o ||
          o.addLocalEchoReceipt(this.credentials.userId, n, ne.L.Read);
      }
      if (r) {
        if (((s = r.getId()), null != o && o.hasPendingEvent(s)))
          throw new Error(
            `Cannot set read receipt to a pending event (${s})`
          );
        null == o ||
          o.addLocalEchoReceipt(
            this.credentials.userId,
            r,
            ne.L.ReadPrivate
          );
      }
      return await this.setRoomReadMarkersHttpRequest(e, t, i, s);
    }
    getUrlPreview(e, t) {
      t = 6e4 * Math.floor(t / 6e4);
      const n = new URL(e);
      n.hash = "";
      const r = t + "_" + (e = n.toString());
      if (r in this.urlPreviewCache) return this.urlPreviewCache[r];
      const o = this.http.authedRequest(
        E.IT.Get,
        "/preview_url",
        { url: e, ts: t.toString() },
        void 0,
        { prefix: E.zs.V3, priority: "low" }
      );
      return (this.urlPreviewCache[r] = o), o;
    }
    sendTyping(e, t, n) {
      if (this.isGuest()) return Promise.resolve({});
      const r = m.RR("/rooms/$roomId/typing/$userId", {
          $roomId: e,
          $userId: this.getUserId(),
        }),
        o = { typing: t };
      return (
        t && (o.timeout = n || 2e4),
        this.http.authedRequest(E.IT.Put, r, void 0, o)
      );
    }
    getRoomUpgradeHistory(e, t = !1, n = !1) {
      const r = this.getRoom(e);
      if (!r) return [];
      return [
        ...this.findPredecessorRooms(r, t, n),
        r,
        ...this.findSuccessorRooms(r, t, n),
      ];
    }
    findPredecessorRooms(e, t, n) {
      var r;
      const o = [];
      let i =
        null === (r = e.findPredecessor(n)) || void 0 === r
          ? void 0
          : r.roomId;
      for (; null !== i; ) {
        var s;
        const r = this.getRoom(i);
        if (null === r) break;
        if (t) {
          const t = r.currentState.getStateEvents(O.Bx.RoomTombstone, "");
          if (!t || t.getContent().replacement_room !== e.roomId) break;
        }
        o.splice(0, 0, r),
          (i =
            null === (s = (e = r).findPredecessor(n)) || void 0 === s
              ? void 0
              : s.roomId);
      }
      return o;
    }
    findSuccessorRooms(e, t, n) {
      const r = [];
      let o = e.currentState.getStateEvents(O.Bx.RoomTombstone, "");
      for (; o; ) {
        const s = this.getRoom(o.getContent().replacement_room);
        if (!s) break;
        if (s.roomId === e.roomId) break;
        if (t) {
          var i;
          const t =
            null === (i = s.findPredecessor(n)) || void 0 === i
              ? void 0
              : i.roomId;
          if (!t || t !== e.roomId) break;
        }
        r.push(s);
        if (new Set(r.map((e) => e.roomId)).size < r.length)
          return r.slice(0, r.length - 1);
        o = (e = s).currentState.getStateEvents(O.Bx.RoomTombstone, "");
      }
      return r;
    }
    invite(e, t, n) {
      return this.membershipChange(e, t, H.O.Invite, n);
    }
    inviteByEmail(e, t) {
      return this.inviteByThreePid(e, "email", t);
    }
    async inviteByThreePid(e, t, n) {
      var r;
      const o = m.RR("/rooms/$roomId/invite", { $roomId: e }),
        i = this.getIdentityServerUrl(!0);
      if (!i)
        return Promise.reject(
          new E.up({
            error: "No supplied identity server URL",
            errcode: "ORG.MATRIX.JSSDK_MISSING_PARAM",
          })
        );
      const s = { id_server: i, medium: t, address: n };
      if (
        null !== (r = this.identityServer) &&
        void 0 !== r &&
        r.getAccessToken
      ) {
        const e = await this.identityServer.getAccessToken();
        e && (s.id_access_token = e);
      }
      return this.http.authedRequest(E.IT.Post, o, void 0, s);
    }
    leave(e) {
      return this.membershipChange(e, void 0, H.O.Leave);
    }
    leaveRoomChain(e, t = !0) {
      const n = this.getRoomUpgradeHistory(e);
      let r = n;
      if (!t) {
        r = [];
        for (const t of n) if ((r.push(t), t.roomId === e)) break;
      }
      const o = {},
        i = [],
        s = (e) =>
          this.leave(e)
            .then(() => {
              delete o[e];
            })
            .catch((t) => {
              o[e] = t;
            });
      for (const e of r) i.push(s(e.roomId));
      return Promise.all(i).then(() => o);
    }
    ban(e, t, n) {
      return this.membershipChange(e, t, H.O.Ban, n);
    }
    forget(e, t = !0) {
      const n = this.membershipChange(e, void 0, "forget");
      return t
        ? n.then(
            (t) => (
              this.store.removeRoom(e), this.emit(Ae.DeleteRoom, e), t
            )
          )
        : n;
    }
    unban(e, t) {
      const n = m.RR("/rooms/$roomId/unban", { $roomId: e }),
        r = { user_id: t };
      return this.http.authedRequest(E.IT.Post, n, void 0, r);
    }
    kick(e, t, n) {
      const r = m.RR("/rooms/$roomId/kick", { $roomId: e }),
        o = { user_id: t, reason: n };
      return this.http.authedRequest(E.IT.Post, r, void 0, o);
    }
    membershipChange(e, t, n, r) {
      const o = m.RR("/rooms/$room_id/$membership", {
        $room_id: e,
        $membership: n,
      });
      return this.http.authedRequest(E.IT.Post, o, void 0, {
        user_id: t,
        reason: r,
      });
    }
    getPushActionsForEvent(e, t = !1) {
      if (!e.getPushActions() || t) {
        const { actions: t, rule: n } =
          this.pushProcessor.actionsAndRuleForEvent(e);
        e.setPushDetails(t, n);
      }
      return e.getPushActions();
    }
    getPushDetailsForEvent(e, t = !1) {
      if (!e.getPushDetails() || t) {
        const { actions: t, rule: n } =
          this.pushProcessor.actionsAndRuleForEvent(e);
        e.setPushDetails(t, n);
      }
      return e.getPushDetails();
    }
    setProfileInfo(e, t) {
      const n = m.RR("/profile/$userId/$info", {
        $userId: this.credentials.userId,
        $info: e,
      });
      return this.http.authedRequest(E.IT.Put, n, void 0, t);
    }
    async setDisplayName(e) {
      const t = await this.setProfileInfo("displayname", {
          displayname: e,
        }),
        n = this.getUser(this.getUserId());
      return (
        n &&
          ((n.displayName = e),
          n.emit(F.U.DisplayName, n.events.presence, n)),
        t
      );
    }
    async setAvatarUrl(e) {
      const t = await this.setProfileInfo("avatar_url", {
          avatar_url: e,
        }),
        n = this.getUser(this.getUserId());
      return (
        n &&
          ((n.avatarUrl = e),
          n.emit(F.U.AvatarUrl, n.events.presence, n)),
        t
      );
    }
    mxcUrlToHttp(e, t, n, r, o, i, s) {
      return (0, S.y)(this.baseUrl, e, t, n, r, o, i, s);
    }
    async setSyncPresence(e) {
      var t;
      null === (t = this.syncApi) || void 0 === t || t.setPresence(e);
    }
    async setPresence(e) {
      const t = m.RR("/presence/$userId/status", {
        $userId: this.credentials.userId,
      });
      if (-1 === ["offline", "online", "unavailable"].indexOf(e.presence))
        throw new Error("Bad presence value: " + e.presence);
      await this.http.authedRequest(E.IT.Put, t, void 0, e);
    }
    getPresence(e) {
      const t = m.RR("/presence/$userId/status", { $userId: e });
      return this.http.authedRequest(E.IT.Get, t);
    }
    scrollback(e, t = 30) {
      let n = 0,
        r = this.ongoingScrollbacks[e.roomId] || {};
      if (r.promise) return r.promise;
      if (r.errorTs) {
        const e = Date.now() - r.errorTs;
        n = Math.max(3e3 - e, 0);
      }
      if (null === e.oldState.paginationToken) return Promise.resolve(e);
      const o = this.store.scrollback(e, t).length;
      if (o === t) return Promise.resolve(e);
      t -= o;
      const i = new Promise((r, o) => {
        (0, m.yy)(n)
          .then(() =>
            this.createMessagesRequest(
              e.roomId,
              e.oldState.paginationToken,
              t,
              h.O.Backward
            )
          )
          .then((t) => {
            var n, o;
            const i = t.chunk.map(this.getEventMapper());
            if (t.state) {
              const n = t.state.map(this.getEventMapper());
              e.currentState.setUnknownStateEvents(n);
            }
            const [s, a, l] = e.partitionThreadedEvents(i);
            this.processAggregatedTimelineEvents(e, s),
              e.addEventsToTimeline(s, !0, e.getLiveTimeline()),
              this.processThreadEvents(e, a, !0),
              l.forEach((t) => e.relations.aggregateChildEvent(t)),
              (e.oldState.paginationToken =
                null !== (n = t.end) && void 0 !== n ? n : null),
              0 === t.chunk.length && (e.oldState.paginationToken = null),
              this.store.storeEvents(
                e,
                i,
                null !== (o = t.end) && void 0 !== o ? o : null,
                !0
              ),
              delete this.ongoingScrollbacks[e.roomId],
              r(e);
          })
          .catch((t) => {
            (this.ongoingScrollbacks[e.roomId] = { errorTs: Date.now() }),
              o(t);
          });
      });
      return (
        (r = { promise: i }), (this.ongoingScrollbacks[e.roomId] = r), i
      );
    }
    getEventMapper(e) {
      return (function (e, t) {
        let n = Boolean(t.preventReEmit);
        const r = !1 !== t.decrypt;
        return function o(i) {
          t.toDevice && delete i.room_id;
          const a = e.getRoom(i.room_id);
          let l;
          a &&
            void 0 === i.state_key &&
            (l = a.findEventById(i.event_id)),
            !l || l.status
              ? (l = new s.kl(i))
              : (l.setUnsigned(j(j({}, l.getUnsigned()), i.unsigned)),
                (n = !0));
          const c = l.getServerAggregatedRelation(O.zZ.Replace);
          if (null != c && c.content) {
            const e = o(c);
            l.makeReplaced(e);
          }
          const d = null == a ? void 0 : a.findThreadForEvent(l);
          return (
            d && l.setThread(d),
            l.isEncrypted() &&
              (n || e.reEmitter.reEmit(l, [s.OQ.Decrypted]),
              r && e.decryptEventIfNeeded(l)),
            n ||
              (e.reEmitter.reEmit(l, [
                s.OQ.Replaced,
                s.OQ.VisibilityChange,
              ]),
              null == a || a.reEmitter.reEmit(l, [s.OQ.BeforeRedaction])),
            l
          );
        };
      })(this, e || {});
    }
    async getEventTimeline(e, t) {
      var n, r, o, i;
      if (!this.timelineSupport)
        throw new Error(
          "timeline support is disabled. Set the 'timelineSupport' parameter to true when creating MatrixClient to enable it."
        );
      if (null == e || !e.room)
        throw new Error("getEventTimeline only supports room timelines");
      if (e.getTimelineForEvent(t)) return e.getTimelineForEvent(t);
      if (e.thread && this.supportsThreads())
        return this.getThreadTimeline(e, t);
      const s = m.RR("/rooms/$roomId/context/$eventId", {
        $roomId: e.room.roomId,
        $eventId: t,
      });
      let a;
      null !== (n = this.clientOpts) &&
        void 0 !== n &&
        n.lazyLoadMembers &&
        (a = {
          filter: JSON.stringify(c.d.LAZY_LOADING_MESSAGES_FILTER),
        });
      const l = await this.http.authedRequest(E.IT.Get, s, a);
      if (!l.event)
        throw new Error(
          "'event' not in '/context' result - homeserver too old?"
        );
      if (e.getTimelineForEvent(t)) return e.getTimelineForEvent(t);
      const d = this.getEventMapper(),
        u = d(l.event);
      if (u.isRelation(oe.RN.name))
        return void this.logger.warn(
          "Tried loading a regular timeline at the position of a thread event"
        );
      const p = [
        ...l.events_after.reverse().map(d),
        u,
        ...l.events_before.map(d),
      ];
      let g = e.getTimelineForEvent(p[0].getId());
      g
        ? g.getState(h.q.BACKWARDS).setUnknownStateEvents(l.state.map(d))
        : ((g = e.addTimeline()),
          g.initialiseState(l.state.map(d)),
          (g.getState(h.q.FORWARDS).paginationToken = l.end));
      const [f, v, y] = e.room.partitionThreadedEvents(p);
      return (
        e.addEventsToTimeline(f, !0, g, l.start),
        this.processThreadEvents(e.room, v, !0),
        this.processAggregatedTimelineEvents(e.room, f),
        y.forEach((t) => e.relations.aggregateChildEvent(t)),
        null !==
          (r =
            null !== (o = e.getTimelineForEvent(t)) && void 0 !== o
              ? o
              : null === (i = e.room.findThreadForEvent(u)) ||
                void 0 === i
              ? void 0
              : i.liveTimeline) && void 0 !== r
          ? r
          : g
      );
    }
    async getThreadTimeline(e, t) {
      var n;
      if (!this.supportsThreads())
        throw new Error(
          "could not get thread timeline: no client support"
        );
      if (!e.room)
        throw new Error(
          "could not get thread timeline: not a room timeline"
        );
      if (!e.thread)
        throw new Error(
          "could not get thread timeline: not a thread timeline"
        );
      const r = m.RR("/rooms/$roomId/context/$eventId", {
          $roomId: e.room.roomId,
          $eventId: t,
        }),
        o = { limit: "0" };
      null !== (n = this.clientOpts) &&
        void 0 !== n &&
        n.lazyLoadMembers &&
        (o.filter = JSON.stringify(c.d.LAZY_LOADING_MESSAGES_FILTER));
      const i = await this.http.authedRequest(E.IT.Get, r, o),
        s = this.getEventMapper(),
        a = s(i.event);
      if (!e.canContain(a)) return;
      const l =
        this.canSupport.get(de.Xj.RelationsRecursion) !==
        de.Tj.Unsupported;
      if (oe.jV.hasServerSideSupport) {
        if (oe.jV.hasServerSideFwdPaginationSupport) {
          var d, u, p;
          if (!e.thread)
            throw new Error(
              "could not get thread timeline: not a thread timeline"
            );
          const n = e.thread,
            r = await this.fetchRelations(
              e.room.roomId,
              n.id,
              null,
              null,
              { dir: h.O.Backward, from: i.start, recurse: l || void 0 }
            ),
            o = await this.fetchRelations(
              e.room.roomId,
              n.id,
              null,
              null,
              { dir: h.O.Forward, from: i.end, recurse: l || void 0 }
            ),
            c = [
              ...o.chunk.reverse().filter(pe(n.id)).map(s),
              a,
              ...r.chunk.filter(pe(n.id)).map(s),
            ];
          for (const t of c) {
            var g;
            await (null === (g = e.thread) || void 0 === g
              ? void 0
              : g.processEvent(t));
          }
          let m = e.getTimelineForEvent(a.getId());
          if (
            (m
              ? m
                  .getState(h.q.BACKWARDS)
                  .setUnknownStateEvents(i.state.map(s))
              : ((m = e.addTimeline()),
                m.initialiseState(i.state.map(s))),
            e.addEventsToTimeline(c, !0, m, o.next_batch),
            !r.next_batch)
          ) {
            const t = await this.fetchRoomEvent(e.room.roomId, n.id);
            e.addEventsToTimeline([s(t)], !0, m, null);
          }
          return (
            m.setPaginationToken(
              null !== (d = r.next_batch) && void 0 !== d ? d : null,
              h.O.Backward
            ),
            m.setPaginationToken(
              null !== (u = o.next_batch) && void 0 !== u ? u : null,
              h.O.Forward
            ),
            this.processAggregatedTimelineEvents(e.room, c),
            null !== (p = e.getTimelineForEvent(t)) && void 0 !== p
              ? p
              : m
          );
        }
        {
          var f;
          const t = e.thread,
            n = await this.fetchRelations(
              e.room.roomId,
              t.id,
              oe.RN.name,
              null,
              { dir: h.O.Backward, from: i.start, recurse: l || void 0 }
            ),
            r = [];
          let o = i.end;
          for (; o; ) {
            var v;
            const n = await this.fetchRelations(
              e.room.roomId,
              t.id,
              oe.RN.name,
              null,
              { dir: h.O.Forward, from: o, recurse: l || void 0 }
            );
            (o = null !== (v = n.next_batch) && void 0 !== v ? v : null),
              r.push(...n.chunk);
          }
          const c = [...r.reverse().map(s), a, ...n.chunk.map(s)];
          for (const t of c) {
            var y;
            await (null === (y = e.thread) || void 0 === y
              ? void 0
              : y.processEvent(t));
          }
          const d = e.getLiveTimeline();
          if (
            (d
              .getState(h.q.BACKWARDS)
              .setUnknownStateEvents(i.state.map(s)),
            e.addEventsToTimeline(c, !0, d, null),
            !n.next_batch)
          ) {
            const n = await this.fetchRoomEvent(e.room.roomId, t.id);
            e.addEventsToTimeline([s(n)], !0, d, null);
          }
          return (
            d.setPaginationToken(
              null !== (f = n.next_batch) && void 0 !== f ? f : null,
              h.O.Backward
            ),
            d.setPaginationToken(null, h.O.Forward),
            this.processAggregatedTimelineEvents(e.room, c),
            d
          );
        }
      }
    }
    async getLatestTimeline(e) {
      if (!this.timelineSupport)
        throw new Error(
          "timeline support is disabled. Set the 'timelineSupport' parameter to true when creating MatrixClient to enable it."
        );
      if (!e.room)
        throw new Error("getLatestTimeline only supports room timelines");
      let t;
      if (null !== e.threadListType) {
        var n;
        t =
          null ===
            (n = (
              await this.createThreadListMessagesRequest(
                e.room.roomId,
                null,
                1,
                h.O.Backward,
                e.threadListType,
                e.getFilter()
              )
            ).chunk) || void 0 === n
            ? void 0
            : n[0];
      } else if (e.thread && oe.jV.hasServerSideSupport) {
        var r;
        const n =
          this.canSupport.get(de.Xj.RelationsRecursion) !==
          de.Tj.Unsupported;
        t =
          null ===
            (r = (
              await this.fetchRelations(
                e.room.roomId,
                e.thread.id,
                oe.RN.name,
                null,
                { dir: h.O.Backward, limit: 1, recurse: n || void 0 }
              )
            ).chunk) || void 0 === r
            ? void 0
            : r[0];
      } else {
        var o, i;
        const n = m.RR("/rooms/$roomId/messages", {
            $roomId: e.room.roomId,
          }),
          r = { dir: "b" };
        null !== (o = this.clientOpts) &&
          void 0 !== o &&
          o.lazyLoadMembers &&
          (r.filter = JSON.stringify(c.d.LAZY_LOADING_MESSAGES_FILTER));
        t =
          null ===
            (i = (await this.http.authedRequest(E.IT.Get, n, r)).chunk) ||
          void 0 === i
            ? void 0
            : i[0];
      }
      if (!t)
        throw new Error(
          "No message returned when trying to construct getLatestTimeline"
        );
      return this.getEventTimeline(e, t.event_id);
    }
    createMessagesRequest(e, t, n = 30, r, o) {
      var i;
      const s = m.RR("/rooms/$roomId/messages", { $roomId: e }),
        a = { limit: n.toString(), dir: r };
      t && (a.from = t);
      let l = null;
      var d;
      (null !== (i = this.clientOpts) &&
        void 0 !== i &&
        i.lazyLoadMembers &&
        (l = Object.assign({}, c.d.LAZY_LOADING_MESSAGES_FILTER)),
      o) &&
        ((l = l || {}),
        Object.assign(
          l,
          null === (d = o.getRoomTimelineFilterComponent()) ||
            void 0 === d
            ? void 0
            : d.toJSON()
        ));
      return (
        l && (a.filter = JSON.stringify(l)),
        this.http.authedRequest(E.IT.Get, s, a)
      );
    }
    createThreadListMessagesRequest(
      e,
      t,
      n = 30,
      r = h.O.Backward,
      o = oe.x3.All,
      i
    ) {
      var s;
      const a = m.RR("/rooms/$roomId/threads", { $roomId: e }),
        l = { limit: n.toString(), dir: r, include: (0, oe.UR)(o) };
      t && (l.from = t);
      let d = {};
      var u;
      (null !== (s = this.clientOpts) &&
        void 0 !== s &&
        s.lazyLoadMembers &&
        (d = ve({}, c.d.LAZY_LOADING_MESSAGES_FILTER)),
      i) &&
        (d = ve(
          ve({}, d),
          null === (u = i.getRoomTimelineFilterComponent()) ||
            void 0 === u
            ? void 0
            : u.toJSON()
        ));
      Object.keys(d).length && (l.filter = JSON.stringify(d));
      const p = {
        prefix:
          oe.jV.hasServerSideListSupport === oe.c1.Stable
            ? E.iD.V1
            : "/_matrix/client/unstable/org.matrix.msc3856",
      };
      return this.http
        .authedRequest(E.IT.Get, a, l, void 0, p)
        .then((e) => {
          var t;
          return ve(
            ve({}, e),
            {},
            {
              chunk:
                null === (t = e.chunk) || void 0 === t
                  ? void 0
                  : t.reverse(),
              start: e.prev_batch,
              end: e.next_batch,
            }
          );
        });
    }
    paginateEventTimeline(e, t) {
      const n = e.getTimelineSet() === this.notifTimelineSet,
        r = this.getRoom(e.getRoomId()),
        o = e.getTimelineSet().threadListType,
        i = e.getTimelineSet().thread,
        s = (t = t || {}).backwards || !1;
      if (n && !s)
        throw new Error(
          "paginateNotifTimeline can only paginate backwards"
        );
      const a = s ? h.q.BACKWARDS : h.q.FORWARDS,
        l = e.getPaginationToken(a),
        c = e.paginationRequests[a];
      if (c) return c;
      let d, u, p;
      var g;
      if (n)
        (d = "/notifications"),
          (u = {
            limit: (null !== (g = t.limit) && void 0 !== g
              ? g
              : 30
            ).toString(),
            only: "highlight",
          }),
          l && "end" !== l && (u.from = l),
          (p = this.http
            .authedRequest(E.IT.Get, "/notifications", u)
            .then(async (t) => {
              const n = t.next_token,
                r = [];
              t.notifications = t.notifications.filter(m.O5);
              for (let e = 0; e < t.notifications.length; e++) {
                const n = t.notifications[e],
                  o = this.getEventMapper()(n.event);
                this.getPushDetailsForEvent(o, !0),
                  (o.event.room_id = n.room_id),
                  (r[e] = o);
              }
              const o = e.getTimelineSet();
              return (
                o.addEventsToTimeline(r, s, e, n),
                this.processAggregatedTimelineEvents(o.room, r),
                s && !t.next_token && e.setPaginationToken(null, a),
                Boolean(t.next_token)
              );
            })
            .finally(() => {
              e.paginationRequests[a] = null;
            })),
          (e.paginationRequests[a] = p);
      else if (null !== o) {
        if (!r) throw new Error("Unknown room " + e.getRoomId());
        if (!oe.jV.hasServerSideFwdPaginationSupport && a === h.O.Forward)
          throw new Error(
            "Cannot paginate threads forwards without server-side support for MSC 3715"
          );
        (p = this.createThreadListMessagesRequest(
          e.getRoomId(),
          l,
          t.limit,
          a,
          o,
          e.getFilter()
        )
          .then((t) => {
            if (t.state) {
              const n = e.getState(a),
                r = t.state.filter(m.O5).map(this.getEventMapper());
              n.setUnknownStateEvents(r);
            }
            const n = t.end,
              o = t.chunk.filter(m.O5).map(this.getEventMapper());
            return (
              e.getTimelineSet().addEventsToTimeline(o, s, e, n),
              this.processAggregatedTimelineEvents(r, o),
              this.processThreadRoots(r, o, s),
              s && t.end == t.start && e.setPaginationToken(null, a),
              t.end !== t.start
            );
          })
          .finally(() => {
            e.paginationRequests[a] = null;
          })),
          (e.paginationRequests[a] = p);
      } else if (i) {
        var f, v;
        const n = this.getRoom(
          null !== (f = e.getRoomId()) && void 0 !== f ? f : void 0
        );
        if (!n) throw new Error("Unknown room " + e.getRoomId());
        const r =
          this.canSupport.get(de.Xj.RelationsRecursion) !==
          de.Tj.Unsupported;
        (p = this.fetchRelations(
          null !== (v = e.getRoomId()) && void 0 !== v ? v : "",
          i.id,
          null,
          null,
          {
            dir: a,
            limit: t.limit,
            from: null != l ? l : void 0,
            recurse: r || void 0,
          }
        )
          .then(async (t) => {
            const r = this.getEventMapper(),
              o = t.chunk.filter(m.O5).filter(pe(i.id)).map(r);
            for (const e of o.slice().reverse()) {
              await (null == i ? void 0 : i.processEvent(e));
              const t = e.getSender();
              (s &&
                null !== (null == i ? void 0 : i.getEventReadUpTo(t))) ||
                n.addLocalEchoReceipt(t, e, ne.L.Read);
            }
            const l = t.next_batch,
              c = e.getTimelineSet();
            if (
              (c.addEventsToTimeline(o, s, e, null != l ? l : null),
              !l && s)
            ) {
              var d, u;
              const t =
                null !== (d = i.rootEvent) && void 0 !== d
                  ? d
                  : r(
                      await this.fetchRoomEvent(
                        null !== (u = e.getRoomId()) && void 0 !== u
                          ? u
                          : "",
                        i.id
                      )
                    );
              c.addEventsToTimeline([t], !0, e, null);
            }
            return (
              this.processAggregatedTimelineEvents(c.room, o),
              s && !l && e.setPaginationToken(null, a),
              Boolean(l)
            );
          })
          .finally(() => {
            e.paginationRequests[a] = null;
          })),
          (e.paginationRequests[a] = p);
      } else {
        if (!r) throw new Error("Unknown room " + e.getRoomId());
        (p = this.createMessagesRequest(
          e.getRoomId(),
          l,
          t.limit,
          a,
          e.getFilter()
        )
          .then((t) => {
            if (t.state) {
              const n = e.getState(a),
                r = t.state.filter(m.O5).map(this.getEventMapper());
              n.setUnknownStateEvents(r);
            }
            const n = t.end,
              o = t.chunk.filter(m.O5).map(this.getEventMapper()),
              i = e.getTimelineSet(),
              [l, , c] = r.partitionThreadedEvents(o);
            i.addEventsToTimeline(l, s, e, n),
              this.processAggregatedTimelineEvents(r, l),
              this.processThreadRoots(
                r,
                l.filter((e) =>
                  e.getServerAggregatedRelation(oe.RN.name)
                ),
                !1
              ),
              c.forEach((e) => r.relations.aggregateChildEvent(e));
            const d = void 0 === t.end || t.end === t.start;
            return s && d && e.setPaginationToken(null, a), !d;
          })
          .finally(() => {
            e.paginationRequests[a] = null;
          })),
          (e.paginationRequests[a] = p);
      }
      return p;
    }
    resetNotifTimelineSet() {
      this.notifTimelineSet &&
        this.notifTimelineSet.resetLiveTimeline("end");
    }
    peekInRoom(e) {
      var t;
      return (
        null === (t = this.peekSync) || void 0 === t || t.stopPeeking(),
        (this.peekSync = new i.w_(
          this,
          this.clientOpts,
          this.buildSyncApiOptions()
        )),
        this.peekSync.peek(e)
      );
    }
    stopPeeking() {
      this.peekSync &&
        (this.peekSync.stopPeeking(), (this.peekSync = null));
    }
    setGuestAccess(e, t) {
      const n = this.sendStateEvent(
        e,
        O.Bx.RoomGuestAccess,
        { guest_access: t.allowJoin ? P.rF.CanJoin : P.rF.Forbidden },
        ""
      );
      let r = Promise.resolve();
      return (
        t.allowRead &&
          (r = this.sendStateEvent(
            e,
            O.Bx.RoomHistoryVisibility,
            { history_visibility: P.Jv.WorldReadable },
            ""
          )),
        Promise.all([r, n]).then()
      );
    }
    requestRegisterEmailToken(e, t, n, r) {
      return this.requestTokenFromEndpoint(
        "/register/email/requestToken",
        { email: e, client_secret: t, send_attempt: n, next_link: r }
      );
    }
    requestRegisterMsisdnToken(e, t, n, r, o) {
      return this.requestTokenFromEndpoint(
        "/register/msisdn/requestToken",
        {
          country: e,
          phone_number: t,
          client_secret: n,
          send_attempt: r,
          next_link: o,
        }
      );
    }
    requestAdd3pidEmailToken(e, t, n, r) {
      return this.requestTokenFromEndpoint(
        "/account/3pid/email/requestToken",
        { email: e, client_secret: t, send_attempt: n, next_link: r }
      );
    }
    requestAdd3pidMsisdnToken(e, t, n, r, o) {
      return this.requestTokenFromEndpoint(
        "/account/3pid/msisdn/requestToken",
        {
          country: e,
          phone_number: t,
          client_secret: n,
          send_attempt: r,
          next_link: o,
        }
      );
    }
    requestPasswordEmailToken(e, t, n, r) {
      return this.requestTokenFromEndpoint(
        "/account/password/email/requestToken",
        { email: e, client_secret: t, send_attempt: n, next_link: r }
      );
    }
    requestPasswordMsisdnToken(e, t, n, r, o) {
      return this.requestTokenFromEndpoint(
        "/account/password/msisdn/requestToken",
        {
          country: e,
          phone_number: t,
          client_secret: n,
          send_attempt: r,
          next_link: o,
        }
      );
    }
    async requestTokenFromEndpoint(e, t) {
      const n = Object.assign({}, t);
      return this.http.request(E.IT.Post, e, void 0, n);
    }
    getRoomPushRule(e, t) {
      var n, r;
      if (this.pushRules)
        return null === (n = this.pushRules[e]) ||
          void 0 === n ||
          null === (r = n.room) ||
          void 0 === r
          ? void 0
          : r.find((e) => e.rule_id === t);
      throw new Error(
        "SyncApi.sync() must be done before accessing to push rules."
      );
    }
    setRoomMutePushRule(e, t, n) {
      let r,
        o = !1;
      const i = this.getRoomPushRule(e, t);
      if (
        (null != i && i.actions.includes(Z.YU.DontNotify) && (o = !0), n)
      )
        if (i) {
          if (!o) {
            const n = m.v6();
            this.deletePushRule(e, Z.Ji.RoomSpecific, i.rule_id)
              .then(() => {
                this.addPushRule(e, Z.Ji.RoomSpecific, t, {
                  actions: [Z.YU.DontNotify],
                })
                  .then(() => {
                    n.resolve();
                  })
                  .catch((e) => {
                    n.reject(e);
                  });
              })
              .catch((e) => {
                n.reject(e);
              }),
              (r = n.promise);
          }
        } else
          r = this.addPushRule(e, Z.Ji.RoomSpecific, t, {
            actions: [Z.YU.DontNotify],
          });
      else
        o && (r = this.deletePushRule(e, Z.Ji.RoomSpecific, i.rule_id));
      if (r)
        return new Promise((e, t) => {
          r.then(() => {
            this.getPushRules()
              .then((t) => {
                (this.pushRules = t), e();
              })
              .catch((e) => {
                t(e);
              });
          }).catch((e) => {
            this.getPushRules()
              .then((n) => {
                (this.pushRules = n), t(e);
              })
              .catch((n) => {
                t(e);
              });
          });
        });
    }
    searchMessageText(e) {
      const t = { search_term: e.query };
      return (
        "keys" in e && (t.keys = e.keys),
        this.search({ body: { search_categories: { room_events: t } } })
      );
    }
    searchRoomEvents(e) {
      const t = {
          search_categories: {
            room_events: {
              search_term: e.term,
              filter: e.filter,
              order_by: X.g.Recent,
              event_context: {
                before_limit: 1,
                after_limit: 1,
                include_profile: !0,
              },
            },
          },
        },
        n = { _query: t, results: [], highlights: [] };
      return this.search({ body: t }).then((e) =>
        this.processRoomEventsSearch(n, e)
      );
    }
    backPaginateRoomEventsSearch(e) {
      if (!e.next_batch)
        return Promise.reject(
          new Error("Cannot backpaginate event search any further")
        );
      if (e.pendingRequest) return e.pendingRequest;
      const t = { body: e._query, next_batch: e.next_batch },
        n = this.search(t, e.abortSignal)
          .then((t) => this.processRoomEventsSearch(e, t))
          .finally(() => {
            e.pendingRequest = void 0;
          });
      return (e.pendingRequest = n), n;
    }
    processRoomEventsSearch(e, t) {
      var n, r;
      const o = t.search_categories.room_events;
      (e.count = o.count), (e.next_batch = o.next_batch);
      const i = new Set(o.highlights);
      e.highlights.forEach((e) => {
        i.add(e);
      }),
        (e.highlights = Array.from(i));
      const s = this.getEventMapper(),
        a =
          null !==
            (n =
              null === (r = o.results) || void 0 === r
                ? void 0
                : r.length) && void 0 !== n
            ? n
            : 0;
      for (let t = 0; t < a; t++) {
        const n = C.q.fromJson(o.results[t], s),
          r = this.getRoom(n.context.getEvent().getRoomId());
        if (r)
          for (const e of n.context.getTimeline()) {
            const t = r.getMember(e.getSender());
            !e.sender && t && (e.sender = t);
          }
        e.results.push(n);
      }
      return e;
    }
    syncLeftRooms() {
      if (this.syncedLeftRooms) return Promise.resolve([]);
      if (this.syncLeftRoomsPromise) return this.syncLeftRoomsPromise;
      const e = new i.w_(
        this,
        this.clientOpts,
        this.buildSyncApiOptions()
      );
      return (
        (this.syncLeftRoomsPromise = e.syncLeftRooms()),
        this.syncLeftRoomsPromise
          .then(() => {
            this.logger.debug(
              "Marking success of sync left room request"
            ),
              (this.syncedLeftRooms = !0);
          })
          .finally(() => {
            this.syncLeftRoomsPromise = void 0;
          }),
        this.syncLeftRoomsPromise
      );
    }
    createFilter(e) {
      const t = m.RR("/user/$userId/filter", {
        $userId: this.credentials.userId,
      });
      return this.http
        .authedRequest(E.IT.Post, t, void 0, e)
        .then((t) => {
          const n = c.d.fromJson(this.credentials.userId, t.filter_id, e);
          return this.store.storeFilter(n), n;
        });
    }
    getFilter(e, t, n) {
      if (n) {
        const n = this.store.getFilter(e, t);
        if (n) return Promise.resolve(n);
      }
      const r = m.RR("/user/$userId/filter/$filterId", {
        $userId: e,
        $filterId: t,
      });
      return this.http.authedRequest(E.IT.Get, r).then((n) => {
        const r = c.d.fromJson(e, t, n);
        return this.store.storeFilter(r), r;
      });
    }
    async getOrCreateFilter(e, t) {
      const n = this.store.getFilterIdByName(e);
      let r;
      if (n) {
        try {
          const e = await this.getFilter(this.credentials.userId, n, !0);
          if (e) {
            const o = e.getDefinition(),
              i = t.getDefinition();
            m.ky(o, i) && (r = n);
          }
        } catch (e) {
          if ("M_UNKNOWN" !== e.errcode && "M_NOT_FOUND" !== e.errcode)
            throw e;
        }
        r || this.store.setFilterIdByName(e, void 0);
      }
      if (r) return r;
      const o = await this.createFilter(t.getDefinition());
      return this.store.setFilterIdByName(e, o.filterId), o.filterId;
    }
    getOpenIdToken() {
      const e = m.RR("/user/$userId/openid/request_token", {
        $userId: this.credentials.userId,
      });
      return this.http.authedRequest(E.IT.Post, e, void 0, {});
    }
    turnServer() {
      return this.http.authedRequest(E.IT.Get, "/voip/turnServer");
    }
    getTurnServers() {
      return this.turnServers || [];
    }
    getTurnServersExpiry() {
      return this.turnServersExpiry;
    }
    get pollingTurnServers() {
      return void 0 !== this.checkTurnServersIntervalID;
    }
    async checkTurnServers() {
      if (!this.canSupportVoip) return;
      let e = !1;
      const t = this.turnServersExpiry - Date.now();
      if (t > _e)
        this.logger.debug(
          "TURN creds are valid for another " +
            t +
            " ms: not fetching new ones."
        ),
          (e = !0);
      else {
        this.logger.debug("Fetching new TURN credentials");
        try {
          const t = await this.turnServer();
          if (t.uris) {
            this.logger.debug(
              "Got TURN URIs: " +
                t.uris +
                " refresh in " +
                t.ttl +
                " secs"
            );
            const n = {
              urls: t.uris,
              username: t.username,
              credential: t.password,
            };
            (this.turnServers = [n]),
              (this.turnServersExpiry = Date.now() + 1e3 * t.ttl),
              (e = !0),
              this.emit(Ae.TurnServers, this.turnServers);
          }
        } catch (e) {
          this.logger.error("Failed to get TURN URIs", e),
            403 === e.httpStatus
              ? (this.logger.info(
                  "TURN access unavailable for this account: stopping credentials checks"
                ),
                null !== this.checkTurnServersIntervalID &&
                  n.g.clearInterval(this.checkTurnServersIntervalID),
                (this.checkTurnServersIntervalID = void 0),
                this.emit(Ae.TurnServersError, e, !0))
              : this.emit(Ae.TurnServersError, e, !1);
        }
      }
      return e;
    }
    setFallbackICEServerAllowed(e) {
      this.fallbackICEServerAllowed = e;
    }
    isFallbackICEServerAllowed() {
      return this.fallbackICEServerAllowed;
    }
    isSynapseAdministrator() {
      const e = m.RR("/_synapse/admin/v1/users/$userId/admin", {
        $userId: this.getUserId(),
      });
      return this.http
        .authedRequest(E.IT.Get, e, void 0, void 0, { prefix: "" })
        .then((e) => e.admin);
    }
    whoisSynapseUser(e) {
      const t = m.RR("/_synapse/admin/v1/whois/$userId", { $userId: e });
      return this.http.authedRequest(E.IT.Get, t, void 0, void 0, {
        prefix: "",
      });
    }
    deactivateSynapseUser(e) {
      const t = m.RR("/_synapse/admin/v1/deactivate/$userId", {
        $userId: e,
      });
      return this.http.authedRequest(E.IT.Post, t, void 0, void 0, {
        prefix: "",
      });
    }
    async fetchClientWellKnown() {
      var e;
      (this.clientWellKnownPromise = g.MN.getRawClientConfig(
        null !== (e = this.getDomain()) && void 0 !== e ? e : void 0
      )),
        (this.clientWellKnown = await this.clientWellKnownPromise),
        this.emit(Ae.ClientWellKnown, this.clientWellKnown);
    }
    getClientWellKnown() {
      return this.clientWellKnown;
    }
    waitForClientWellKnown() {
      if (!this.clientRunning) throw new Error("Client is not running");
      return this.clientWellKnownPromise;
    }
    storeClientOptions() {
      const e = ["boolean", "string", "number"],
        t = Object.entries(this.clientOpts)
          .filter(([t, n]) => e.includes(typeof n))
          .reduce((e, [t, n]) => ((e[t] = n), e), {});
      return this.store.storeClientOptions(t);
    }
    async _unstable_getSharedRooms(e) {
      const t = await this.doesServerSupportUnstableFeature(ke),
        n = await this.doesServerSupportUnstableFeature(Fe),
        r = await this.doesServerSupportUnstableFeature(Se);
      if (!t && !n && !r)
        throw Error("Server does not support the Mutual Rooms API");
      let o, i;
      r
        ? ((o = "/uk.half-shot.msc2666/user/mutual_rooms"),
          (i = { user_id: e }))
        : ((o = m.RR(
            `/uk.half-shot.msc2666/user/${
              n ? "mutual_rooms" : "shared_rooms"
            }/$userId`,
            { $userId: e }
          )),
          (i = {}));
      const s = [];
      let a = null;
      do {
        const e = {};
        null != a && r && (e.batch_token = a);
        const t = await this.http.authedRequest(
          E.IT.Get,
          o,
          ve(ve({}, i), e),
          void 0,
          { prefix: E.iD.Unstable }
        );
        s.push(...t.joined),
          (a = void 0 !== t.next_batch_token ? t.next_batch_token : null);
      } while (null != a);
      return s;
    }
    async getVersions() {
      if (this.serverVersionsPromise) return this.serverVersionsPromise;
      this.serverVersionsPromise = this.http
        .authedRequest(
          E.IT.Get,
          "/_matrix/client/versions",
          void 0,
          void 0,
          { prefix: "" }
        )
        .catch((e) => {
          throw ((this.serverVersionsPromise = void 0), e);
        });
      const e = await this.serverVersionsPromise;
      return (
        (this.canSupport = await (0, de.yk)(e)),
        this.serverVersionsPromise
      );
    }
    async isVersionSupported(e) {
      const { versions: t } = await this.getVersions();
      return t && t.includes(e);
    }
    async doesServerSupportUnstableFeature(e) {
      const t = await this.getVersions();
      if (!t) return !1;
      const n = t.unstable_features;
      return n && !!n[e];
    }
    async doesServerForceEncryptionForPreset(e) {
      const t = await this.getVersions();
      if (!t) return !1;
      const n = t.unstable_features,
        r = e.includes("_chat") ? e.substring(0, e.indexOf("_chat")) : e;
      return n && !!n[`io.element.e2ee_forced.${r}`];
    }
    async doesServerSupportThread() {
      if (await this.isVersionSupported("v1.4"))
        return {
          threads: oe.c1.Stable,
          list: oe.c1.Stable,
          fwdPagination: oe.c1.Stable,
        };
      try {
        const [e, t, n, r, o, i] = await Promise.all([
          this.doesServerSupportUnstableFeature("org.matrix.msc3440"),
          this.doesServerSupportUnstableFeature(
            "org.matrix.msc3440.stable"
          ),
          this.doesServerSupportUnstableFeature("org.matrix.msc3856"),
          this.doesServerSupportUnstableFeature(
            "org.matrix.msc3856.stable"
          ),
          this.doesServerSupportUnstableFeature("org.matrix.msc3715"),
          this.doesServerSupportUnstableFeature(
            "org.matrix.msc3715.stable"
          ),
        ]);
        return {
          threads: (0, oe.FD)(t, e),
          list: (0, oe.FD)(r, n),
          fwdPagination: (0, oe.FD)(i, o),
        };
      } catch (e) {
        return {
          threads: oe.c1.None,
          list: oe.c1.None,
          fwdPagination: oe.c1.None,
        };
      }
    }
    hasLazyLoadMembersEnabled() {
      var e;
      return !(
        null === (e = this.clientOpts) ||
        void 0 === e ||
        !e.lazyLoadMembers
      );
    }
    setCanResetTimelineCallback(e) {
      this.canResetTimelineCallback = e;
    }
    getCanResetTimelineCallback() {
      return this.canResetTimelineCallback;
    }
    async relations(e, t, n, r, o = { dir: h.O.Backward }) {
      var i, s;
      const a = r ? this.getEncryptedIfNeededEventType(e, r) : null,
        [l, c] = await Promise.all([
          this.fetchRoomEvent(e, t),
          this.fetchRelations(e, t, n, a, o),
        ]),
        d = this.getEventMapper(),
        u = l ? d(l) : void 0;
      let m = c.chunk.map(d);
      if (a === O.Bx.RoomMessageEncrypted) {
        const e = u ? m.concat(u) : m;
        await Promise.all(e.map((e) => this.decryptEventIfNeeded(e))),
          null !== r && (m = m.filter((e) => e.getType() === r));
      }
      return (
        u &&
          n === O.zZ.Replace &&
          (m = m.filter((e) => e.getSender() === u.getSender())),
        {
          originalEvent: null != u ? u : null,
          events: m,
          nextBatch:
            null !== (i = c.next_batch) && void 0 !== i ? i : null,
          prevBatch:
            null !== (s = c.prev_batch) && void 0 !== s ? s : null,
        }
      );
    }
    getCrossSigningCacheCallbacks() {
      var e;
      return null === (e = this.crypto) || void 0 === e
        ? void 0
        : e.crossSigningInfo.getCacheCallbacks();
    }
    generateClientSecret() {
      return (0, N.DU)(32);
    }
    decryptEventIfNeeded(e, t) {
      return (
        e.shouldAttemptDecryption() &&
          this.isCryptoEnabled() &&
          e.attemptDecryption(this.cryptoBackend, t),
        e.isBeingDecrypted()
          ? e.getDecryptionPromise()
          : Promise.resolve()
      );
    }
    termsUrlForService(e, t) {
      switch (e) {
        case b.S.IS:
          return this.http.getUrl("/terms", void 0, E.Pw.V2, t);
        case b.S.IM:
          return this.http.getUrl(
            "/terms",
            void 0,
            "/_matrix/integrations/v1",
            t
          );
        default:
          throw new Error("Unsupported service type");
      }
    }
    getHomeserverUrl() {
      return this.baseUrl;
    }
    getIdentityServerUrl(e = !1) {
      var t, n;
      return e &&
        ((null !== (t = this.idBaseUrl) &&
          void 0 !== t &&
          t.startsWith("http://")) ||
          (null !== (n = this.idBaseUrl) &&
            void 0 !== n &&
            n.startsWith("https://")))
        ? this.idBaseUrl.split("://")[1]
        : this.idBaseUrl;
    }
    setIdentityServerUrl(e) {
      (this.idBaseUrl = m.hc(e)), this.http.setIdBaseUrl(this.idBaseUrl);
    }
    getAccessToken() {
      return this.http.opts.accessToken || null;
    }
    getRefreshToken() {
      var e;
      return null !== (e = this.http.opts.refreshToken) && void 0 !== e
        ? e
        : null;
    }
    setAccessToken(e) {
      (this.http.opts.accessToken = e),
        (this.serverVersionsPromise = void 0);
    }
    isLoggedIn() {
      return void 0 !== this.http.opts.accessToken;
    }
    makeTxnId() {
      return "m" + new Date().getTime() + "." + this.txnCtr++;
    }
    isUsernameAvailable(e) {
      return this.http
        .authedRequest(E.IT.Get, "/register/available", { username: e })
        .then((e) => e.available)
        .catch((e) => "M_USER_IN_USE" !== e.errcode && Promise.reject(e));
    }
    register(e, t, n, r, o, i, s) {
      n && (r.session = n);
      const a = { auth: r, refresh_token: !0 };
      return (
        null != e && (a.username = e),
        null != t && (a.password = t),
        null != i && (a.guest_access_token = i),
        null != s && (a.inhibit_login = s),
        this.registerRequest(a)
      );
    }
    registerGuest({ body: e } = {}) {
      return this.registerRequest(e || {}, "guest");
    }
    registerRequest(e, t) {
      const n = {};
      return (
        t && (n.kind = t), this.http.request(E.IT.Post, "/register", n, e)
      );
    }
    refreshToken(e) {
      const t = (t) =>
        this.http.authedRequest(
          E.IT.Post,
          "/refresh",
          void 0,
          { refresh_token: e },
          { prefix: t, inhibitLogoutEmit: !0 }
        );
      return t(E.iD.V3).catch((e) => {
        if ("M_UNRECOGNIZED" === e.errcode) return t(E.iD.V1);
        throw e;
      });
    }
    loginFlows() {
      return this.http.request(E.IT.Get, "/login");
    }
    login(e, t) {
      return this.http
        .authedRequest(
          E.IT.Post,
          "/login",
          void 0,
          ve(ve({}, t), {}, { type: e })
        )
        .then(
          (e) => (
            e.access_token &&
              e.user_id &&
              ((this.http.opts.accessToken = e.access_token),
              (this.credentials = { userId: e.user_id })),
            e
          )
        );
    }
    loginWithPassword(e, t) {
      return this.login("m.login.password", { user: e, password: t });
    }
    getCasLoginUrl(e) {
      return this.getSsoLoginUrl(e, "cas");
    }
    getSsoLoginUrl(e, t = "sso", n, r) {
      let o = "/login/" + t + "/redirect";
      n && (o += "/" + n);
      const i = { redirectUrl: e, [Te.unstable]: r };
      return this.http.getUrl(o, i).href;
    }
    loginWithToken(e) {
      return this.login("m.login.token", { token: e });
    }
    async logout(e = !1) {
      var t, n;
      if (
        null !== (t = this.crypto) &&
        void 0 !== t &&
        null !== (n = t.backupManager) &&
        void 0 !== n &&
        n.getKeyBackupEnabled()
      )
        try {
          for (
            ;
            (await this.crypto.backupManager.backupPendingKeys(200)) > 0;

          );
        } catch (e) {
          this.logger.error(
            "Key backup request failed when logging out. Some keys may be missing from backup",
            e
          );
        }
      return (
        e && (this.stopClient(), this.http.abort()),
        this.http.authedRequest(E.IT.Post, "/logout")
      );
    }
    deactivateAccount(e, t) {
      const n = {};
      return (
        e && (n.auth = e),
        void 0 !== t && (n.erase = t),
        this.http.authedRequest(
          E.IT.Post,
          "/account/deactivate",
          void 0,
          n
        )
      );
    }
    async requestLoginToken(e) {
      const t = { auth: e };
      return this.http.authedRequest(
        E.IT.Post,
        "/login/get_token",
        void 0,
        t,
        { prefix: E.iD.V1 }
      );
    }
    getFallbackAuthUrl(e, t) {
      const n = m.RR("/auth/$loginType/fallback/web", { $loginType: e });
      return this.http.getUrl(n, { session: t }).href;
    }
    async createRoom(e) {
      var t;
      const n = (e.invite_3pid || []).filter((e) => !e.id_access_token);
      if (
        n.length > 0 &&
        null !== (t = this.identityServer) &&
        void 0 !== t &&
        t.getAccessToken
      ) {
        const e = await this.identityServer.getAccessToken();
        if (e) for (const t of n) t.id_access_token = e;
      }
      return this.http.authedRequest(E.IT.Post, "/createRoom", void 0, e);
    }
    fetchRelations(e, t, n, r, o = { dir: h.O.Backward }) {
      let i = o;
      oe.jV.hasServerSideFwdPaginationSupport === oe.c1.Experimental &&
        (i = (0, m.Ab)("dir", "org.matrix.msc3715.dir", i)),
        this.canSupport.get(de.Xj.RelationsRecursion) ===
          de.Tj.Unstable &&
          (i = (0, m.Ab)("recurse", "org.matrix.msc3981.recurse", i));
      const s = m.hm(i);
      let a = "/rooms/$roomId/relations/$eventId";
      null !== n
        ? ((a += "/$relationType"), null !== r && (a += "/$eventType"))
        : null !== r &&
          (this.logger.warn(
            `eventType: ${r} ignored when fetching\n            relations as relationType is null`
          ),
          (r = null));
      const l = m.RR(a + "?" + s, {
        $roomId: e,
        $eventId: t,
        $relationType: n,
        $eventType: r,
      });
      return this.http.authedRequest(E.IT.Get, l, void 0, void 0, {
        prefix: E.iD.V1,
      });
    }
    roomState(e) {
      const t = m.RR("/rooms/$roomId/state", { $roomId: e });
      return this.http.authedRequest(E.IT.Get, t);
    }
    fetchRoomEvent(e, t) {
      const n = m.RR("/rooms/$roomId/event/$eventId", {
        $roomId: e,
        $eventId: t,
      });
      return this.http.authedRequest(E.IT.Get, n);
    }
    members(e, t, n, r) {
      const o = {};
      t && (o.membership = t),
        n && (o.not_membership = n),
        r && (o.at = r);
      const i = m.hm(o),
        s = m.RR("/rooms/$roomId/members?" + i, { $roomId: e });
      return this.http.authedRequest(E.IT.Get, s);
    }
    upgradeRoom(e, t) {
      const n = m.RR("/rooms/$roomId/upgrade", { $roomId: e });
      return this.http.authedRequest(E.IT.Post, n, void 0, {
        new_version: t,
      });
    }
    getStateEvent(e, t, n) {
      const r = { $roomId: e, $eventType: t, $stateKey: n };
      let o = m.RR("/rooms/$roomId/state/$eventType", r);
      return (
        void 0 !== n && (o = m.RR(o + "/$stateKey", r)),
        this.http.authedRequest(E.IT.Get, o)
      );
    }
    sendStateEvent(e, t, n, r = "", o = {}) {
      const i = { $roomId: e, $eventType: t, $stateKey: r };
      let s = m.RR("/rooms/$roomId/state/$eventType", i);
      return (
        void 0 !== r && (s = m.RR(s + "/$stateKey", i)),
        this.http.authedRequest(E.IT.Put, s, void 0, n, o)
      );
    }
    roomInitialSync(e, t) {
      var n;
      const r = m.RR("/rooms/$roomId/initialSync", { $roomId: e });
      return this.http.authedRequest(E.IT.Get, r, {
        limit:
          null !== (n = null == t ? void 0 : t.toString()) && void 0 !== n
            ? n
            : "30",
      });
    }
    async setRoomReadMarkersHttpRequest(e, t, n, r) {
      const o = m.RR("/rooms/$roomId/read_markers", { $roomId: e }),
        i = { [ne.L.FullyRead]: t, [ne.L.Read]: n };
      return (
        ((await this.doesServerSupportUnstableFeature(
          "org.matrix.msc2285.stable"
        )) ||
          (await this.isVersionSupported("v1.4"))) &&
          (i[ne.L.ReadPrivate] = r),
        this.http.authedRequest(E.IT.Post, o, void 0, i)
      );
    }
    getJoinedRooms() {
      const e = m.RR("/joined_rooms", {});
      return this.http.authedRequest(E.IT.Get, e);
    }
    getJoinedRoomMembers(e) {
      const t = m.RR("/rooms/$roomId/joined_members", { $roomId: e });
      return this.http.authedRequest(E.IT.Get, t);
    }
    publicRooms(e = {}) {
      let { server: t, limit: n, since: o } = e,
        i = (0, r.A)(e, ge);
      if (0 === Object.keys(i).length) {
        const e = { server: t, limit: n, since: o };
        return this.http.authedRequest(E.IT.Get, "/publicRooms", e);
      }
      {
        const e = { server: t },
          r = ve({ limit: n, since: o }, i);
        return this.http.authedRequest(E.IT.Post, "/publicRooms", e, r);
      }
    }
    createAlias(e, t) {
      const n = m.RR("/directory/room/$alias", { $alias: e }),
        r = { room_id: t };
      return this.http.authedRequest(E.IT.Put, n, void 0, r);
    }
    deleteAlias(e) {
      const t = m.RR("/directory/room/$alias", { $alias: e });
      return this.http.authedRequest(E.IT.Delete, t);
    }
    getLocalAliases(e) {
      const t = m.RR("/rooms/$roomId/aliases", { $roomId: e }),
        n = E.iD.V3;
      return this.http.authedRequest(E.IT.Get, t, void 0, void 0, {
        prefix: n,
      });
    }
    getRoomIdForAlias(e) {
      const t = m.RR("/directory/room/$alias", { $alias: e });
      return this.http.authedRequest(E.IT.Get, t);
    }
    getRoomDirectoryVisibility(e) {
      const t = m.RR("/directory/list/room/$roomId", { $roomId: e });
      return this.http.authedRequest(E.IT.Get, t);
    }
    setRoomDirectoryVisibility(e, t) {
      const n = m.RR("/directory/list/room/$roomId", { $roomId: e });
      return this.http.authedRequest(E.IT.Put, n, void 0, {
        visibility: t,
      });
    }
    searchUserDirectory({ term: e, limit: t }) {
      const n = { search_term: e };
      return (
        void 0 !== t && (n.limit = t),
        this.http.authedRequest(
          E.IT.Post,
          "/user_directory/search",
          void 0,
          n
        )
      );
    }
    uploadContent(e, t) {
      return this.http.uploadContent(e, t);
    }
    cancelUpload(e) {
      return this.http.cancelUpload(e);
    }
    getCurrentUploads() {
      return this.http.getCurrentUploads();
    }
    getProfileInfo(e, t) {
      const n = t
        ? m.RR("/profile/$userId/$info", { $userId: e, $info: t })
        : m.RR("/profile/$userId", { $userId: e });
      return this.http.authedRequest(E.IT.Get, n);
    }
    getThreePids() {
      return this.http.authedRequest(E.IT.Get, "/account/3pid");
    }
    async addThreePidOnly(e) {
      return this.http.authedRequest(
        E.IT.Post,
        "/account/3pid/add",
        void 0,
        e
      );
    }
    async bindThreePid(e) {
      return this.http.authedRequest(
        E.IT.Post,
        "/account/3pid/bind",
        void 0,
        e
      );
    }
    async unbindThreePid(e, t) {
      const n = {
        medium: e,
        address: t,
        id_server: this.getIdentityServerUrl(!0),
      };
      return this.http.authedRequest(
        E.IT.Post,
        "/account/3pid/unbind",
        void 0,
        n
      );
    }
    deleteThreePid(e, t) {
      return this.http.authedRequest(
        E.IT.Post,
        "/account/3pid/delete",
        void 0,
        { medium: e, address: t }
      );
    }
    setPassword(e, t, n) {
      const r = { auth: e, new_password: t, logout_devices: n };
      return this.http.authedRequest(
        E.IT.Post,
        "/account/password",
        void 0,
        r
      );
    }
    getDevices() {
      return this.http.authedRequest(E.IT.Get, "/devices");
    }
    getDevice(e) {
      const t = m.RR("/devices/$device_id", { $device_id: e });
      return this.http.authedRequest(E.IT.Get, t);
    }
    setDeviceDetails(e, t) {
      const n = m.RR("/devices/$device_id", { $device_id: e });
      return this.http.authedRequest(E.IT.Put, n, void 0, t);
    }
    deleteDevice(e, t) {
      const n = m.RR("/devices/$device_id", { $device_id: e }),
        r = {};
      return (
        t && (r.auth = t),
        this.http.authedRequest(E.IT.Delete, n, void 0, r)
      );
    }
    deleteMultipleDevices(e, t) {
      const n = { devices: e };
      t && (n.auth = t);
      return this.http.authedRequest(
        E.IT.Post,
        "/delete_devices",
        void 0,
        n
      );
    }
    async getPushers() {
      const e = await this.http.authedRequest(E.IT.Get, "/pushers");
      return (
        (await this.doesServerSupportUnstableFeature(
          "org.matrix.msc3881"
        )) ||
          (e.pushers = e.pushers.map(
            (e) => (e.hasOwnProperty(O.cr.name) || (e[O.cr.name] = !0), e)
          )),
        e
      );
    }
    setPusher(e) {
      return this.http.authedRequest(
        E.IT.Post,
        "/pushers/set",
        void 0,
        e
      );
    }
    removePusher(e, t) {
      const n = { pushkey: e, app_id: t, kind: null };
      return this.http.authedRequest(
        E.IT.Post,
        "/pushers/set",
        void 0,
        n
      );
    }
    setLocalNotificationSettings(e, t) {
      const n = `${O.Xs.name}.${e}`;
      return this.setAccountData(n, t);
    }
    getPushRules() {
      return this.http
        .authedRequest(E.IT.Get, "/pushrules/")
        .then((e) => (this.setPushRules(e), this.pushRules));
    }
    setPushRules(e) {
      (this.pushRules = p.j.rewriteDefaultRules(e, this.getUserId())),
        this.pushProcessor.updateCachedPushRuleKeys(this.pushRules);
    }
    addPushRule(e, t, n, r) {
      const o = m.RR("/pushrules/" + e + "/$kind/$ruleId", {
        $kind: t,
        $ruleId: n,
      });
      return this.http.authedRequest(E.IT.Put, o, void 0, r);
    }
    deletePushRule(e, t, n) {
      const r = m.RR("/pushrules/" + e + "/$kind/$ruleId", {
        $kind: t,
        $ruleId: n,
      });
      return this.http.authedRequest(E.IT.Delete, r);
    }
    setPushRuleEnabled(e, t, n, r) {
      const o = m.RR("/pushrules/" + e + "/$kind/$ruleId/enabled", {
        $kind: t,
        $ruleId: n,
      });
      return this.http.authedRequest(E.IT.Put, o, void 0, { enabled: r });
    }
    setPushRuleActions(e, t, n, r) {
      const o = m.RR("/pushrules/" + e + "/$kind/$ruleId/actions", {
        $kind: t,
        $ruleId: n,
      });
      return this.http.authedRequest(E.IT.Put, o, void 0, { actions: r });
    }
    search({ body: e, next_batch: t }, n) {
      const r = {};
      return (
        t && (r.next_batch = t),
        this.http.authedRequest(E.IT.Post, "/search", r, e, {
          abortSignal: n,
        })
      );
    }
    uploadKeysRequest(e, t) {
      return this.http.authedRequest(
        E.IT.Post,
        "/keys/upload",
        void 0,
        e
      );
    }
    uploadKeySignatures(e) {
      return this.http.authedRequest(
        E.IT.Post,
        "/keys/signatures/upload",
        void 0,
        e
      );
    }
    downloadKeysForUsers(e, { token: t } = {}) {
      const n = { device_keys: {} };
      return (
        void 0 !== t && (n.token = t),
        e.forEach((e) => {
          n.device_keys[e] = [];
        }),
        this.http.authedRequest(E.IT.Post, "/keys/query", void 0, n)
      );
    }
    claimOneTimeKeys(e, t = "signed_curve25519", n) {
      const r = {};
      void 0 === t && (t = "signed_curve25519");
      for (const [n, o] of e) {
        const e = r[n] || {};
        (0, m.C6)(r, n, e), (0, m.C6)(e, o, t);
      }
      const o = { one_time_keys: r };
      n && (o.timeout = n);
      return this.http.authedRequest(E.IT.Post, "/keys/claim", void 0, o);
    }
    getKeyChanges(e, t) {
      const n = { from: e, to: t };
      return this.http.authedRequest(E.IT.Get, "/keys/changes", n);
    }
    uploadDeviceSigningKeys(e, t) {
      const n = Object.assign({}, t);
      return (
        e && Object.assign(n, { auth: e }),
        this.http.authedRequest(
          E.IT.Post,
          "/keys/device_signing/upload",
          void 0,
          n,
          { prefix: E.iD.Unstable }
        )
      );
    }
    registerWithIdentityServer(e) {
      if (!this.idBaseUrl)
        throw new Error("No identity server base URL set");
      const t = this.http.getUrl(
        "/account/register",
        void 0,
        E.Pw.V2,
        this.idBaseUrl
      );
      return this.http.requestOtherUrl(E.IT.Post, t, e);
    }
    requestEmailToken(e, t, n, r, o) {
      const i = {
        client_secret: t,
        email: e,
        send_attempt: null == n ? void 0 : n.toString(),
      };
      return (
        r && (i.next_link = r),
        this.http.idServerRequest(
          E.IT.Post,
          "/validate/email/requestToken",
          i,
          E.Pw.V2,
          o
        )
      );
    }
    requestMsisdnToken(e, t, n, r, o, i) {
      const s = {
        client_secret: n,
        country: e,
        phone_number: t,
        send_attempt: null == r ? void 0 : r.toString(),
      };
      return (
        o && (s.next_link = o),
        this.http.idServerRequest(
          E.IT.Post,
          "/validate/msisdn/requestToken",
          s,
          E.Pw.V2,
          i
        )
      );
    }
    submitMsisdnToken(e, t, n, r) {
      const o = { sid: e, client_secret: t, token: n };
      return this.http.idServerRequest(
        E.IT.Post,
        "/validate/msisdn/submitToken",
        o,
        E.Pw.V2,
        null != r ? r : void 0
      );
    }
    submitMsisdnTokenOtherUrl(e, t, n, r) {
      const o = { sid: t, client_secret: n, token: r };
      return this.http.requestOtherUrl(E.IT.Post, e, o);
    }
    getIdentityHashDetails(e) {
      return this.http.idServerRequest(
        E.IT.Get,
        "/hash_details",
        void 0,
        E.Pw.V2,
        e
      );
    }
    async identityHashedLookup(e, t) {
      const r = {},
        o = await this.getIdentityHashDetails(t);
      if (!o || !o.lookup_pepper || !o.algorithms)
        throw new Error("Unsupported identity server: bad response");
      r.pepper = o.lookup_pepper;
      const i = {};
      if (o.algorithms.includes("sha256")) {
        const t = new n.g.Olm.Utility();
        (r.addresses = e.map((e) => {
          const n = e[0].toLowerCase(),
            o = e[1].toLowerCase(),
            s = t
              .sha256(`${n} ${o} ${r.pepper}`)
              .replace(/\+/g, "-")
              .replace(/\//g, "_");
          return (i[s] = e[0]), s;
        })),
          (r.algorithm = "sha256");
      } else {
        if (!o.algorithms.includes("none"))
          throw new Error(
            "Unsupported identity server: unknown hash algorithm"
          );
        (r.addresses = e.map((e) => {
          const t = `${e[0].toLowerCase()} ${e[1].toLowerCase()}`;
          return (i[t] = e[0]), t;
        })),
          (r.algorithm = "none");
      }
      const s = await this.http.idServerRequest(
        E.IT.Post,
        "/lookup",
        r,
        E.Pw.V2,
        t
      );
      if (null == s || !s.mappings) return [];
      const a = [];
      for (const e of Object.keys(s.mappings)) {
        const t = s.mappings[e],
          n = i[e];
        if (!n)
          throw new Error(
            "Identity server returned more results than expected"
          );
        a.push({ address: n, mxid: t });
      }
      return a;
    }
    async lookupThreePid(e, t, n) {
      const r = (await this.identityHashedLookup([[t, e]], n)).find(
        (e) => e.address === t
      );
      if (!r) return {};
      return { address: t, medium: e, mxid: r.mxid };
    }
    async bulkLookupThreePids(e, t) {
      const n = await this.identityHashedLookup(
          e.map((e) => [e[1], e[0]]),
          t
        ),
        r = [];
      for (const t of n) {
        const n = e.find((e) => e[1] === t.address);
        if (!n)
          throw new Error("Identity sever returned unexpected results");
        r.push([n[0], t.address, t.mxid]);
      }
      return { threepids: r };
    }
    getIdentityAccount(e) {
      return this.http.idServerRequest(
        E.IT.Get,
        "/account",
        void 0,
        E.Pw.V2,
        e
      );
    }
    sendToDevice(e, t, n) {
      const r = m.RR("/sendToDevice/$eventType/$txnId", {
          $eventType: e,
          $txnId: n || this.makeTxnId(),
        }),
        o = { messages: m.HF(t) },
        i = new Map();
      for (const [e, n] of t) i.set(e, Array.from(n.keys()));
      return (
        this.logger.debug(`PUT ${r}`, i),
        this.http.authedRequest(E.IT.Put, r, void 0, o)
      );
    }
    queueToDevice(e) {
      return this.toDeviceMessageQueue.queueBatch(e);
    }
    getThirdpartyProtocols() {
      return this.http
        .authedRequest(E.IT.Get, "/thirdparty/protocols")
        .then((e) => {
          if (!e || "object" != typeof e)
            throw new Error(
              `/thirdparty/protocols did not return an object: ${e}`
            );
          return e;
        });
    }
    getThirdpartyLocation(e, t) {
      const n = m.RR("/thirdparty/location/$protocol", { $protocol: e });
      return this.http.authedRequest(E.IT.Get, n, t);
    }
    getThirdpartyUser(e, t) {
      const n = m.RR("/thirdparty/user/$protocol", { $protocol: e });
      return this.http.authedRequest(E.IT.Get, n, t);
    }
    getTerms(e, t) {
      const n = this.termsUrlForService(e, t);
      return this.http.requestOtherUrl(E.IT.Get, n);
    }
    agreeToTerms(e, t, n, r) {
      const o = this.termsUrlForService(e, t),
        i = { Authorization: "Bearer " + n };
      return this.http.requestOtherUrl(
        E.IT.Post,
        o,
        { user_accepts: r },
        { headers: i }
      );
    }
    reportEvent(e, t, n, r) {
      const o = m.RR("/rooms/$roomId/report/$eventId", {
        $roomId: e,
        $eventId: t,
      });
      return this.http.authedRequest(E.IT.Post, o, void 0, {
        score: n,
        reason: r,
      });
    }
    getRoomHierarchy(e, t, n, r = !1, o) {
      const i = m.RR("/rooms/$roomId/hierarchy", { $roomId: e }),
        s = {
          suggested_only: String(r),
          max_depth: null == n ? void 0 : n.toString(),
          from: o,
          limit: null == t ? void 0 : t.toString(),
        };
      return this.http
        .authedRequest(E.IT.Get, i, s, void 0, { prefix: E.iD.V1 })
        .catch((e) => {
          if ("M_UNRECOGNIZED" === e.errcode)
            return this.http.authedRequest(E.IT.Get, i, s, void 0, {
              prefix: "/_matrix/client/unstable/org.matrix.msc2946",
            });
          throw e;
        });
    }
    async unstableCreateFileTree(e) {
      const { room_id: t } = await this.createRoom({
        name: e,
        preset: P.k.PrivateChat,
        power_level_content_override: ve(
          ve({}, W),
          {},
          { users: { [this.getUserId()]: 100 } }
        ),
        creation_content: { [O.Ct]: O.CJ.Space },
        initial_state: [
          {
            type: O.D7.name,
            state_key: O.nN.name,
            content: { [O.ud.name]: !0 },
          },
          {
            type: O.Bx.RoomEncryption,
            state_key: "",
            content: { algorithm: f.MEGOLM_ALGORITHM },
          },
        ],
      });
      return new J(this, t);
    }
    unstableGetFileTreeSpace(e) {
      var t, n;
      const r = this.getRoom(e);
      if ((null == r ? void 0 : r.getMyMembership()) !== H.O.Join)
        return null;
      const o = r.currentState.getStateEvents(O.Bx.RoomCreate, ""),
        i = r.currentState.getStateEvents(O.D7.name, O.nN.name);
      if (!o) throw new Error("Expected single room create event");
      return null != i &&
        null !== (t = i.getContent()) &&
        void 0 !== t &&
        t[O.ud.name]
        ? (null === (n = o.getContent()) || void 0 === n
            ? void 0
            : n[O.Ct]) !== O.CJ.Space
          ? null
          : new J(this, e)
        : null;
    }
    slidingSync(e, t, n) {
      const r = {};
      e.pos && ((r.pos = e.pos), delete e.pos),
        e.timeout && ((r.timeout = e.timeout), delete e.timeout);
      const o = e.clientTimeout;
      return (
        delete e.clientTimeout,
        this.http.authedRequest(E.IT.Post, "/sync", r, e, {
          prefix: "/_matrix/client/unstable/org.matrix.msc3575",
          baseUrl: t,
          localTimeoutMs: o,
          abortSignal: n,
        })
      );
    }
    supportsThreads() {
      var e;
      return (
        (null === (e = this.clientOpts) || void 0 === e
          ? void 0
          : e.threadSupport) || !1
      );
    }
    supportsIntentionalMentions() {
      return (
        this.canSupport.get(de.Xj.IntentionalMentions) !==
        de.Tj.Unsupported
      );
    }
    async getRoomSummary(e, t) {
      const n = { prefix: "/_matrix/client/unstable/im.nheko.summary" };
      try {
        const r = m.RR("/summary/$roomid", { $roomid: e });
        return await this.http.authedRequest(
          E.IT.Get,
          r,
          { via: t },
          void 0,
          n
        );
      } catch (r) {
        if (r instanceof E.up && "M_UNRECOGNIZED" === r.errcode) {
          const r = m.RR("/rooms/$roomid/summary", { $roomid: e });
          return await this.http.authedRequest(
            E.IT.Get,
            r,
            { via: t },
            void 0,
            n
          );
        }
        throw r;
      }
    }
    processThreadEvents(e, t, n) {
      e.processThreadedEvents(t, n);
    }
    processThreadRoots(e, t, n) {
      this.supportsThreads() && e.processThreadRoots(t, n);
    }
    processBeaconEvents(e, t) {
      this.processAggregatedTimelineEvents(e, t);
    }
    processAggregatedTimelineEvents(e, t) {
      null != t &&
        t.length &&
        e &&
        (e.currentState.processBeaconEvents(t, this),
        e.processPollEvents(t));
    }
    async whoami() {
      return this.http.authedRequest(E.IT.Get, "/account/whoami");
    }
    async timestampToEvent(e, t, n) {
      const r = m.RR("/rooms/$roomId/timestamp_to_event", { $roomId: e }),
        o = { ts: t.toString(), dir: n };
      try {
        return await this.http.authedRequest(E.IT.Get, r, o, void 0, {
          prefix: E.iD.V1,
        });
      } catch (e) {
        if (
          "M_UNRECOGNIZED" === e.errcode &&
          (400 === e.httpStatus ||
            404 === e.httpStatus ||
            405 === e.httpStatus)
        )
          return await this.http.authedRequest(E.IT.Get, r, o, void 0, {
            prefix: "/_matrix/client/unstable/org.matrix.msc3030",
          });
        throw e;
      }
    }
    async getAuthIssuer() {
      return this.http.request(E.IT.Get, "/auth_issuer", void 0, void 0, {
        prefix: E.iD.Unstable + "/org.matrix.msc2965",
      });
    }
  }