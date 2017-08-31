export const dowloader = (linksArray) => {

    function asyncLoop(iterations, func, callback) {
        var index = 0;
        var done = false;
        var loop = {
            next: function() {
                if (done) {
                    return;
                }

                if (index < iterations) {
                    index++;
                    func(loop);

                } else {
                    done = true;
                    if (typeof callback === 'function') {
                        callback();
                    }
                }
            },

            iteration: function() {
                return index - 1;
            },

            break: function() {
                done = true;
                if (typeof callback === 'function') {
                    callback();
                }
            }
        };
        loop.next();
        return loop;
    }

    return new Promise(resolve => {
        asyncLoop(linksArray.length, (loop) => {
            var file = linksArray[loop.iteration()];
            var script = document.createElement('script');
            script.setAttribute('type', 'text/javascript');
            script.setAttribute('src', file);
            script.onload = function () {
                loop.next();
            };
            document.head.appendChild(script);
        }, () => {
            resolve();
        });
    });
};
