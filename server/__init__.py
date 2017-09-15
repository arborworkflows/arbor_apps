import os
from girder.utility.plugin_utilities import registerPluginWebroot

def load(info):
    class App:
        _cp_config = {
            'tools.staticdir.on': True,
            'tools.staticdir.dir': os.path.join(info['pluginRootDir'], 'dist'),
            'tools.staticdir.index': 'index.html'
        }

    registerPluginWebroot(App(), info['name'])
