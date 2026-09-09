export class SnapshotRejected extends Error {
    code;
    detail;
    constructor(code, message, detail) {
        super(message);
        this.code = code;
        this.detail = detail;
        this.name = 'SnapshotRejected';
    }
}
