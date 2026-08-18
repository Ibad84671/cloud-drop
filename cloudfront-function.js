function handler(event) {
    var request = event.request;
    var uri = request.uri;
    if (uri.startsWith('/t/')) {
        request.uri = '/t.html';
    }
    return request;
}