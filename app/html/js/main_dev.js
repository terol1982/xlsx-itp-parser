//app/html/js/main.js
$(document).ready(function(){

    function uploadFiles(formData) {
        $.ajax({
            url: '/upload_file',
            method: 'post',
            data: formData,
            processData: false,
            contentType: false,
            xhr: function () {
                var xhr = new XMLHttpRequest();

                // Add progress event listener to the upload.
                xhr.upload.addEventListener('progress', function (event) {
                    var progressBar = $('.progress-bar');

                    if (event.lengthComputable) {
                        var percent = (event.loaded / event.total) * 100;
                        progressBar.width(percent + '%');

                        if (percent === 100) {
                            progressBar.removeClass('active');
                        }
                    }
                });

                return xhr;
            }
        }).done(handleSuccess).fail(function (xhr, status) {
            $('#result').html(status)
           // alert(status);
        });
    }

    /**
     * Handle the upload response data from server and display them.
     *
     * @param data
     */
    function handleSuccess(data) {
        if (data.length > 0) {
            var html = '';
            for (var i=0; i < data.length; i++) {
                var res = data[i];

                if (res.status&&res.results) {
                    html += '<div class=""><a href="/' + res.publicPath + '" title="Скачать обработанный файл">' + res.filename + '   ('+res.size+' KB, '+res.results+' строк обработано)</a>  </div>';
                } else {
                    html += '<div class=""><a href="/' + res.publicPath + '" >Не верный формат файла ' + res.filename  + '</a></div>';
                }
            }

            $('#result').html(html);
        } else {
            alert('No images were uploaded.')
        }
    }

// Set the progress bar to 0 when a file(s) is selected.
    $('#fileInput1').on('change', function () {
        $('.progress-bar').width('0%');

        //retrieve list of saved categories
        let post_data = {cmd: 'cat', act: 'get'};
        $.ajax({
            type: 'POST',
            data: post_data,
            url: '/cmd',
            dataType: "json",
            beforeSend: function () {
                $('#category').text('загрузка категорий...')
            },
            success: function (res) {
                //let res = JSON.parse(data1)
                //console.log(data1)

                if(res.error){
                    $('#category').text('загрузка категорий...')
                }
                else {
                    $('#category').text(res.categories)
                }


            },
            error: function () {

            },
            timeout: 5000 // sets timeout to 5 seconds
        });
    });


    // $('#uploadBtn').on('click', function(e){
    //     event.preventDefault();
    //     console.log('lick')
    // })

// On form submit, handle the file uploads.
    $('#upload-files').on('submit', function (event) {
        event.preventDefault();

        $('#result').html('Uploading file...')

        // Get the files from input, create new FormData.
        var files = $('#fileInput1').get(0).files;
            //formData = new FormData();

        var  formData = new FormData(document.getElementById('upload-files'));

        // console.log(files)
        // return

        if (files.length === 0) {
            alert('Файлы не выбраны!');
            return false;
        }

        // if (files.length > 3) {
        //     alert('You can only upload up to 3 files.');
        //     return false;
        // }

        // Append the files to the formData.
        // for (var i=0; i < files.length; i++) {
        //     let file = files[i];
        //     formData.append('filesInput[]', file, file.name);
        // }

       // console.log(formData2.get('kurs'))
        // Note: We are only appending the file inputs to the FormData.
           uploadFiles(formData);
    });





})
