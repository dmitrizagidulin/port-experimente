/* tslint:disable */
/* eslint-disable */

/**
 * Opens one file, chunk by chunk, as it downloads.
 *
 * **What [`FileOpener::push`] returns is provisional.** Each chunk authenticates under this
 * file's key, but the file is the one its author signed only once the digest checks. The
 * caller writes the plaintext to a temporary destination and releases it — saves it under
 * its final name, renders it, hands it to a page — only after [`FileOpener::finish`] has
 * returned and [`FileOpener::verified`] is `true`. On any error it discards the
 * destination. `FileManifest`'s *Reading* rules; `data-rooms-files.md` §4.1.
 */
export class FileOpener {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    /**
     * See [`FileOpener::finish`].
     */
    finish(): string;
    /**
     * See [`FileOpener::push`].
     */
    push(chunk: Uint8Array): Uint8Array;
    /**
     * See [`FileOpener::with_key`].
     */
    static withKey(room_id: string, key: string, file_manifest: string, blob_manifest: string): FileOpener;
    /**
     * See [`FileOpener::verified`].
     */
    readonly verified: boolean;
}

/**
 * Seals one file, in pieces of any size, as it is read.
 */
export class FileSealer {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    /**
     * See [`FileSealer::finish`].
     */
    finish(): Uint8Array;
    /**
     * See [`FileSealer::manifests`].
     */
    manifests(): string;
    /**
     * See [`FileSealer::push`].
     */
    push(data: Uint8Array): Uint8Array;
    /**
     * See [`FileSealer::with_key`].
     */
    static withKey(room_id: string, file_id: string, epoch: bigint, key: string, size: bigint, padme: boolean, name: string, media_type?: string | null, segment_size?: number | null): FileSealer;
    /**
     * The size every chunk but the last has: split [`FileSealer::push`]'s output on it.
     */
    readonly chunkSize: number;
}

/**
 * A member's signing identity — the JS boundary over [`identity::MemberIdentity`].
 *
 * Every secret this member has now lives on this side: the Ed25519 key that names their
 * `did:key` and signs, and the MLS keys inside [`RoomMember`]. JavaScript holds two opaque
 * snapshots and no key.
 */
export class Identity {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Mint a fresh `did:key`.
     */
    static mint(): Identity;
    /**
     * See [`identity::MemberIdentity::present`].
     */
    present(vac: string, vmc: string, action: string, nonce?: string | null): string;
    /**
     * Restore one from [`Identity::snapshot`].
     */
    static restore(snapshot: string): Identity;
    /**
     * See [`identity::MemberIdentity::sign_document`].
     */
    signDocument(document: string): string;
    /**
     * **Key material.** Per-origin, per-device storage and nowhere else — anyone holding
     * this is this member.
     */
    snapshot(): string;
    readonly did: string;
}

/**
 * One room this browser can open.
 *
 * Holds the MLS group and the epoch key chain. Every method that resolves a key takes
 * `&mut self`, because walking the chain memoises what it derives — opening a room's
 * history is one walk, not one per record.
 */
export class RoomMember {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    /**
     * See [`RoomMember::add_links`].
     */
    addLinks(links: string): void;
    /**
     * See [`RoomMember::apply_commit`].
     */
    applyCommit(commit: Uint8Array): string;
    /**
     * See [`RoomMember::earliest_readable_epoch`].
     */
    earliestReadableEpoch(): number;
    /**
     * See [`RoomMember::file_opener`].
     */
    fileOpener(file_manifest: string, blob_manifest: string): FileOpener;
    /**
     * See [`RoomMember::file_sealer`].
     */
    fileSealer(size: bigint, padme: boolean, name: string, media_type?: string | null, segment_size?: number | null): FileSealer;
    /**
     * See [`RoomMember::join`].
     */
    static join(room_id: string, minted: string, welcome: Uint8Array, invitation: string, spent: string, issuer_key?: Uint8Array | null): RoomMember;
    /**
     * See [`RoomMember::open_record`].
     */
    openRecord(key: string, version: bigint, sealed: string): Uint8Array;
    /**
     * See [`RoomMember::restore`].
     */
    static restore(snapshot: string): RoomMember;
    /**
     * See [`RoomMember::seal_record`].
     */
    sealRecord(key: string, version: bigint, plaintext: Uint8Array): string;
    /**
     * See [`RoomMember::snapshot`].
     */
    snapshot(): string;
    /**
     * See [`RoomMember::epoch`].
     */
    readonly epoch: number;
    /**
     * See [`RoomMember::room_id`].
     */
    readonly roomId: string;
}

/**
 * See [`mint_key_package`].
 */
export function mintKeyPackage(member_did: string, room_id: string, invitation: string, spent: string, issuer_key?: Uint8Array | null): string;

/**
 * Run the five invitation checks and return the credential id to record as spent.
 *
 * Exposed separately from [`mint_key_package`] so a surface can *show* the checks — which
 * is most of what a person needs to understand about a room they are being let into.
 */
export function verifyInvitation(invitation: string, room_id: string, member_did: string, spent: string, issuer_key?: Uint8Array | null): string;
