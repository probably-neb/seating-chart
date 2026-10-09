const ID_LENGTH = 32;
const ID_ENTITY_PREFIX_LENGTH = 4;
const ID_PREFIX_LENGTH = ID_ENTITY_PREFIX_LENGTH + "_".length;
const ID_SUFFIX_LENGTH = ID_LENGTH - ID_PREFIX_LENGTH;

const ID_ALPHABET =
    "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
// largest multiple of the alphabet length that fits in a byte, bytes at or
// above it are rejected so every character is equally likely
const ID_BYTE_LIMIT = 256 - (256 % ID_ALPHABET.length);

const ID_PREFIXES = /** @type {const} */ ({
    seat: "seat",
    student: "stud",
    chart: "chrt",
    user: "user",
});

function generate_suffix() {
    let suffix = "";
    const bytes = new Uint8Array(ID_SUFFIX_LENGTH * 2);
    while (suffix.length < ID_SUFFIX_LENGTH) {
        crypto.getRandomValues(bytes);
        for (let i = 0; i < bytes.length && suffix.length < ID_SUFFIX_LENGTH; i++) {
            if (bytes[i] < ID_BYTE_LIMIT) {
                suffix += ID_ALPHABET[bytes[i] % ID_ALPHABET.length];
            }
        }
    }
    return suffix;
}

const ID = {
    /** @param {keyof typeof ID_PREFIXES} for_entity */
    generate_for(for_entity) {
        return ID_PREFIXES[for_entity] + "_" + generate_suffix();
    },
    LENGTH: ID_LENGTH,
};

export default ID;
