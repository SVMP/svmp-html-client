svmp-html-client
================

A pure HTML5 &amp; Javascript client for SVMP

Setup & Installation
====================

Requirements:
* python3
* virtualenv

Clone the repository and set up dependencies:

```
$ git clone https://github.com/svmp/svmp-html-client
$ cd svmp-html-client
$ virtualenv venv
$ source venv/bin/activate
(venv) $ pip install -r requirements.txt
```

Copy ```config.cfg.example``` to ```config.cfg``` and set host to the webserver's address as seen by the client, and port to the port the webserver should run on.

Running the webserver:

```
(venv) $ python webserver.py
```