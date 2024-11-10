import { customAlphabet } from "nanoid";

const ID_LENGTH = 32;
const ID_ENTITY_PREFIX_LENGTH = 4;
const ID_PREFIX_LENGTH = ID_ENTITY_PREFIX_LENGTH + "_".length;
const ID_SUFFIX_LENGTH = ID_LENGTH - ID_PREFIX_LENGTH;

const generate_nano_id = customAlphabet(
    "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ",
    ID_SUFFIX_LENGTH,
).bind(null, undefined);

const ID_PREFIXES = {
    seat: "seat",
    student: "stud",
    chart: "chrt",
    user: "user",
} as const;

namespace ID {
    export function generate_for(forEntity: keyof typeof ID_PREFIXES) {
        return ID_PREFIXES[forEntity] + "_" + generate_nano_id();
    }

    export const LENGTH = ID_LENGTH;
}

export default ID;
