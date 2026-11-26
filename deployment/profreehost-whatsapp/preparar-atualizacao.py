"""Create an upload-only overlay from a local copy of the current TechPlace htdocs."""
import argparse
import re
import shutil
from pathlib import Path


def replace(source, before, after):
    if source.count(before) != 1:
        raise ValueError(f"Trecho esperado em uma única ocorrência: {before[:100]}")
    return source.replace(before, after, 1)


def substitute(source, pattern, after):
    updated, count = re.subn(pattern, lambda _: after, source, flags=re.MULTILINE)
    if count != 1:
        raise ValueError(f"Trecho esperado em uma única ocorrência: {pattern[:100]}")
    return updated


def app(source):
    source = substitute(source, r"^import \{sendLocalNotice\}[^\n]+",
                        "import { whatsappAction, whatsappOrder } from '/techplace-whatsapp.js';")
    source = substitute(source, r"^      let phone=String\(client.phone[^\n]+\n[^\n]+wa\.me[^\n]+\n[^\n]+result.textContent=[^\n]+",
                        """      actions.append(whatsappAction('Enviar garantia pelo WhatsApp','warranty',order.id));
      result.textContent='Garantia registrada.';""")
    start = source.index('const orderNoticeTypes =')
    end = source.index('function options(', start)
    source = source[:start] + """function orderNoticePanel() {
  return '<section class="tp-os-notices" data-wa-order></section>';
}
function orderWhatsApp(order) {
  showDialog('Notificar cliente · '+orderNumber(order), orderNoticePanel(), button('Voltar à ordem',{action:'service-view',id:order.id}));
  whatsappOrder(dialog.querySelector('[data-wa-order]'), order.id);
}

""" + source[end:]
    source = replace(source, "  void refreshMedia(order.id);", "  whatsappOrder(dialog.querySelector('[data-wa-order]'), order.id);\n  void refreshMedia(order.id);")
    source, count = re.subn(r"^    case 'service-wa-(prep|repair|ready)':[^\n]+\n", "", source, flags=re.MULTILINE)
    if count != 3:
        raise ValueError("Botões antigos de status não encontrados.")
    return source


def panels(source):
    source = "import { whatsappAction, whatsappClient, whatsappClients, whatsappConnection } from '/techplace-whatsapp.js';\n" + source
    source = substitute(source, r"^function whatsapp\([^\n]+\nfunction message\([^\n]+\n", "")
    source = substitute(source, r"^ const rules=data.rules\|\|\{\};for[^\n]+\n p.append\(caption\('A meta mostra[^\n]+",
                        " p.append(whatsappClient(c.id));holder.append(p);")
    source = substitute(source, r"const wa=whatsapp\(c.phone,'Olá, '\+c.name\+'! Segue a garantia[^\n]+",
                        "q.append(whatsappAction('Enviar garantia pelo WhatsApp','warranty',o.id));}")
    source = substitute(source, r"^ if\(c.marketing&&c.phone\)message\(holder[^\n]+\n", "")
    source = replace(source, "r.append(p,newForm);await search();", "r.append(p,newForm,whatsappClients(async id=>showClient(r,await crm('client',{id}))));await search();")
    source = substitute(source, r"^ const birthdays=panel\('Aniversariantes de hoje'[^\n]+\n const after=panel\('Garantia e pós-serviço'[^\n]+",
                        """ r.append(whatsappClients(async id=>showClient(r,await crm('client',{id}))));});return r;}""")
    source = substitute(source, r"^    \{id:'whatsapp'[^\n]+", """    {id:'whatsapp',name:'WhatsApp',group:'Clientes',short:'WA',desc:'Envio autorizado de garantias, status e benefícios.',status:'Ver conexão',detail:'Vincule o WhatsApp da loja ou um número pessoal para teste.'},""")
    source = replace(source, "    if(item.kind==='financial')", "    if(item.id==='whatsapp'){const wa=whatsappConnection();details.append(wa);wa.open=true;}\n    else if(item.kind==='financial')")
    source = replace(source, "p.append(quick,log,f);", "p.append(whatsappConnection(),quick,log,f);")
    return source


def crm(source):
    source = replace(source, "require __DIR__.'/expenses.php';", "require __DIR__.'/expenses.php';\nrequire protegido('whatsapp-store.php');")
    return substitute(source, r"^   sql\(\$db,'UPDATE tp_crm_rules_v1 SET[^\n]+", """   $newRules=[$purchase,$service,crmText($p['purchase_reward']??'',160,true),crmText($p['service_reward']??'',160,true),crmText($p['birthday_reward']??'',160,true)];
   $waConfig=protegido('whatsapp-config.php');
   if (is_file($waConfig)) {
       $allowed=require $waConfig;
       if (!in_array($account['id'],$allowed['admins']??[],true)) throw new Entrada('Somente um administrador pode alterar as regras de fidelidade.',403);
       waInstall($db);
       transacao($db,function() use ($db,$newRules) {
           waFreezeEarned($db);
           sql($db,'UPDATE tp_crm_rules_v1 SET purchase_target=?,service_target=?,purchase_reward=?,service_reward=?,birthday_reward=? WHERE id=1',$newRules);
       });
   } else {
       sql($db,'UPDATE tp_crm_rules_v1 SET purchase_target=?,service_target=?,purchase_reward=?,service_reward=?,birthday_reward=? WHERE id=1',$newRules);
   }
   resposta(crmRules($db));return;""")


def main():
    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument('current', type=Path, help='Cópia local da pasta htdocs em uso')
    cli.add_argument('output', type=Path, help='Diretório novo para receber apenas os arquivos a publicar')
    cli.add_argument('--preparar-conexao', action='store_true',
                     help='Publicar a aba e preservar os fluxos atuais até o conector ficar disponível')
    args = cli.parse_args()
    if not (args.current / 'warranty-pdf.js').is_file():
        cli.error('A pasta de origem precisa conter o módulo atual de garantia em PDF.')
    try:
        files = {name: transform((args.current / name).read_text(encoding='utf8'))
                 for name, transform in [('app.js', app), ('techplace-plus.js', panels), ('crm-api.php', crm)]}
        index = (args.current / 'index.html').read_text(encoding='utf8')
        files['index.html'] = substitute(index, r'(?<=src=")/app\.js(?:\?[^"]*)?', '/app.js?v=tp-wa-cloud-1')
        files['index.html'] = replace(files['index.html'], '</head>', '    <link rel="stylesheet" href="/techplace-whatsapp.css?v=1">\n</head>')
        files['app.js'] = substitute(files['app.js'], r"(?<=from ')/techplace-plus\.js(?:\?[^']*)?", '/techplace-plus.js?v=tp-wa-cloud-1')
    except (OSError, ValueError) as error:
        cli.error(f'Versão diferente da edição conhecida. Nenhum arquivo foi gravado. {error}')
    if args.output.exists():
        cli.error('Use um diretório novo para a atualização.')
    shutil.copytree(Path(__file__).with_name('htdocs'), args.output)
    bootstrap = args.output / 'techplace-wa-bootstrap.js'
    if args.preparar_conexao:
        old_app = re.search(r'(?<=src=")/app\.js(?:\?[^"]*)?', index).group()
        bootstrap.write_text(bootstrap.read_text(encoding='utf8').replace('/app.js?v=tp45-busca-fornecedor', old_app), encoding='utf8')
        files['index.html'] = files['index.html'].replace('/app.js?v=tp-wa-cloud-1', '/techplace-wa-bootstrap.js?v=1')
        files['app-whatsapp.js'] = files.pop('app.js').replace('/techplace-plus.js?v=tp-wa-cloud-1', '/techplace-plus-whatsapp.js?v=1').replace('/crm-api.php', '/crm-api-whatsapp.php')
        files['techplace-plus-whatsapp.js'] = files.pop('techplace-plus.js').replace('/crm-api.php', '/crm-api-whatsapp.php')
        files['crm-api-whatsapp.php'] = files.pop('crm-api.php')
    else:
        bootstrap.unlink()
    for name, content in files.items():
        (args.output / name).write_text(content, encoding='utf8')


if __name__ == '__main__':
    main()
