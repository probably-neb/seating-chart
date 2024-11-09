import { customAlphabet } from "nanoid";

const ID_LENGTH = 32;
const ID_ENTITY_PREFIX_LENGTH = 4;
const ID_PREFIX_LENGTH = ID_ENTITY_PREFIX_LENGTH + "_".length;
const ID_SUFFIX_LENGTH = ID_LENGTH - ID_PREFIX_LENGTH;

const generate_nano_id = customAlphabet(
    "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"
).bind(null, ID_SUFFIX_LENGTH);

const ID_PREFIXES = {
    seat: "seat",
    student: "stud",
    chart: "chrt",
} as const;

namespace ID {
    export function generate_for(forEntity: keyof typeof ID_PREFIXES) {
        return ID_PREFIXES[forEntity] + "_" + generate_nano_id(); // FIXME: use nanoid
    }

    export const LENGTH = ID_LENGTH;
}

export default ID;
