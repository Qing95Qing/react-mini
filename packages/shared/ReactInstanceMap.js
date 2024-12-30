export function get(key) {
    return key._reactInternals;
}

export function set(key, value) {
    key._reactInternals = value;
}
