from docutils.parsers.rst import directives, Directive
from docutils.core import publish_parts
import sys


class IgnoreIndex(Directive):

    required_arguments = 1
    optional_arguments = 1
    final_argument_whitespace = True
    option_spec = {'single': directives.unchanged,
                   }
    has_content = True

    def run(self):
        # print(self.arguments, self.options)
        return []


directives.register_directive('index', IgnoreIndex)

value = sys.stdin.read()
parts = publish_parts(source=value, writer_name="html5", settings_overrides={})
sys.stdout.write(parts["html_title"].encode(parts['encoding']))
sys.stdout.write(parts["fragment"].encode(parts['encoding']))
sys.stdout.write(parts["footer"].encode(parts['encoding']))

