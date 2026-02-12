#!/usr/bin/env python
#
# SPDX-FileCopyrightText: 2014-2022 Fredrik Ahlberg, Angus Gratton,
# Espressif Systems (Shanghai) CO LTD, other contributors as noted.
#
# SPDX-License-Identifier: GPL-2.0-or-later

# This executable script is a thin wrapper around the main functionality
# in the esptool Python package

# When updating this script, please also update espefuse.py and espsecure.py

import contextlib
import os
import sys

import esptool

if __name__ == "__main__":
    esptool._main()
