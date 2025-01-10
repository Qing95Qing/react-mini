function getEventCharCode(nativeEvent) {
    let charCode;
    const keyCode = nativeEvent.keyCode;

    if ('charCode' in nativeEvent) {
        charCode = nativeEvent.charCode;

        if (charCode === 0 && keyCode === 13) {
            charCode = 13;
        }
    } else {
        charCode = keyCode;
    }
    if (charCode === 10) {
        charCode = 13;
    }

    if (charCode >= 32 || charCode === 13) {
        return charCode;
    }

    return 0;
}

export default getEventCharCode;
